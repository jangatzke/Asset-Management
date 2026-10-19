/**
 * AI Assistant Service
 *
 * Lets an administrator point the app at any OpenAI-compatible chat-completions
 * API (base URL + model + API key) and runs two assisted routine tasks in a
 * background job:
 *
 *  1. Ticket triage notes — for recently opened tickets without an internal
 *     work note, asks the model for a short triage summary (likely cause,
 *     suggested next steps) and posts it as an INTERNAL ticket comment.
 *  2. Knowledge drafts — for resolved incident tickets lacking a KB article,
 *     asks the model to distil a draft knowledge-base article from the
 *     description, resolution notes and internal comments. Drafts stay in
 *     'draft' status; a human reviews and publishes them.
 *
 * Every action (and every skip/error) is written to ai_activity_log so the
 * admin UI can show a protocol of what the assistant did. The API key is
 * encrypted at application layer (AES-256-GCM) like other stored credentials
 * and is never returned to clients.
 */

import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';
import { encrypt, decrypt, isEncrypted } from './credentialEncryption.service';
import { nextDisplayId } from './displayId.service';

type AnyObject = Record<string, any>;

export interface AiConfigUpdate {
  enabled?: boolean;
  baseUrl?: string | null;
  model?: string | null;
  apiKey?: string | null;
  temperature?: number;
  maxTokens?: number;
  requestTimeoutSeconds?: number;
  intervalMinutes?: number;
  summarizeTickets?: boolean;
  knowledgeDrafts?: boolean;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

const PASSWORD_PLACEHOLDERS = new Set(['', '********', '••••••••', '__KEEP_EXISTING__']);
/** Cap the number of tickets/articles one background run may touch, bounding cost. */
const MAX_ITEMS_PER_TASK = 10;
/** Only look at activity from the last 30 days. */
const LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

export class AiService {
  constructor(private readonly client: AxiosInstance = axios.create({ timeout: 60_000 })) {}

  // ---- Credential encryption helpers (same pattern as email gateway) --------

  private encryptSecret(plaintext: string): string {
    return encrypt(plaintext);
  }

  private decryptSecret(stored: string | null | undefined): string | null {
    if (!stored) return null;
    if (isEncrypted(stored)) {
      try {
        return decrypt(stored);
      } catch (error) {
        throw new AppError('Stored AI API key could not be decrypted — check CREDENTIAL_ENCRYPTION_KEY', 500);
      }
    }
    return stored;
  }

  // ---- Configuration --------------------------------------------------------

  private sanitizeConfig(config: AnyObject | null) {
    if (!config) return null;
    const { apiKey: _apiKey, ...safe } = config;
    return {
      ...safe,
      apiKeyConfigured: Boolean(config.apiKey),
    };
  }

  async ensureConfig() {
    const existing = await (prisma as any).aiConfig.findUnique({ where: { configKey: 'singleton' } });
    if (existing) return existing;
    return (prisma as any).aiConfig.create({ data: {} });
  }

  async getConfig() {
    return this.sanitizeConfig(await this.ensureConfig());
  }

  async updateConfig(data: AiConfigUpdate, userId = 'system') {
    const existing = await this.ensureConfig();
    const updateData: AnyObject = {};

    if (data.enabled !== undefined) updateData.enabled = Boolean(data.enabled);
    if (data.baseUrl !== undefined) {
      const url = String(data.baseUrl ?? '').trim().replace(/\/+$/, '');
      if (url && !/^https?:\/\//i.test(url)) throw new AppError('Base URL must start with http:// or https://', 400);
      updateData.baseUrl = url || null;
    }
    if (data.model !== undefined) updateData.model = String(data.model ?? '').trim() || null;
    if (data.apiKey !== undefined && !PASSWORD_PLACEHOLDERS.has(String(data.apiKey))) {
      const key = String(data.apiKey).trim();
      updateData.apiKey = key ? this.encryptSecret(key) : null;
    }
    if (data.temperature !== undefined) {
      const value = Number(data.temperature);
      if (!Number.isFinite(value) || value < 0 || value > 2) throw new AppError('Temperature must be between 0 and 2', 400);
      updateData.temperature = value;
    }
    if (data.maxTokens !== undefined) {
      const value = Number(data.maxTokens);
      if (!Number.isInteger(value) || value < 64 || value > 8000) throw new AppError('Max tokens must be between 64 and 8000', 400);
      updateData.maxTokens = value;
    }
    if (data.requestTimeoutSeconds !== undefined) {
      const value = Number(data.requestTimeoutSeconds);
      if (!Number.isInteger(value) || value < 5 || value > 300) throw new AppError('Request timeout must be between 5 and 300 seconds', 400);
      updateData.requestTimeoutSeconds = value;
    }
    if (data.intervalMinutes !== undefined) {
      const value = Number(data.intervalMinutes);
      if (!Number.isInteger(value) || value < 5 || value > 10080) throw new AppError('Interval must be between 5 and 10080 minutes', 400);
      updateData.intervalMinutes = value;
      updateData.nextRunAt = new Date(Date.now() + value * 60_000);
    }
    if (data.summarizeTickets !== undefined) updateData.summarizeTickets = Boolean(data.summarizeTickets);
    if (data.knowledgeDrafts !== undefined) updateData.knowledgeDrafts = Boolean(data.knowledgeDrafts);

    updateData.updatedBy = userId;
    const config = await (prisma as any).aiConfig.update({ where: { id: existing.id }, data: updateData });

    await auditService.logEventStandalone(prisma, {
      userId,
      action: 'CONFIG_CHANGE',
      entityType: 'AiConfig',
      entityId: existing.id,
      details: `Updated AI assistant configuration (${Object.keys(updateData).join(', ')})`,
    });
    return this.sanitizeConfig(config);
  }

  /** Resolve a usable client; throws with an actionable message when unconfigured. */
  private async resolveClient() {
    const config = await this.ensureConfig();
    const baseUrl = String(config.baseUrl ?? '').trim();
    const model = String(config.model ?? '').trim();
    const apiKey = this.decryptSecret(config.apiKey);
    if (!baseUrl) throw new AppError('AI base URL is not configured', 400);
    if (!model) throw new AppError('AI model is not configured', 400);
    if (!apiKey) throw new AppError('AI API key is not configured', 400);
    return { config, baseUrl, model, apiKey };
  }

  /** Single chat-completion call against the configured OpenAI-compatible endpoint. */
  private async chat(endpoint: { baseUrl: string; model: string; apiKey: string; requestTimeoutSeconds?: number }, messages: { role: string; content: string }[], options: { temperature?: number; maxTokens?: number } = {}): Promise<string> {
    const url = `${endpoint.baseUrl}/chat/completions`;
    try {
      const response = await this.client.post<ChatCompletionResponse>(
        url,
        {
          model: endpoint.model,
          messages,
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens ?? 1200,
        },
        {
          headers: { Authorization: `Bearer ${endpoint.apiKey}`, 'Content-Type': 'application/json' },
          timeout: Math.max(5, Number(endpoint.requestTimeoutSeconds ?? 60)) * 1000,
        },
      );
      const content = response.data?.choices?.[0]?.message?.content;
      if (!content || !String(content).trim()) throw new Error('Empty completion');
      return String(content).trim();
    } catch (error: any) {
      const status = error?.response?.status;
      const detail = typeof error?.response?.data?.error?.message === 'string' ? error.response.data.error.message : error?.message;
      throw new Error(status ? `HTTP ${status}: ${detail}` : String(detail));
    }
  }

  /** Connectivity test used by the admin UI ("Test connection"). */
  async testConnection(userId = 'system') {
    const endpoint = await this.resolveClient();
    const started = Date.now();
    const reply = await this.chat(endpoint, [
      { role: 'system', content: 'You are a connectivity test. Reply with exactly: OK' },
      { role: 'user', content: 'ping' },
    ], { temperature: 0, maxTokens: 16 });
    await auditService.logEventStandalone(prisma, {
      userId,
      action: 'CONFIG_CHANGE',
      entityType: 'AiConfig',
      entityId: endpoint.config.id,
      details: `Tested AI connection (${endpoint.model}) in ${Date.now() - started}ms`,
    });
    return { ok: true, model: endpoint.model, latencyMs: Date.now() - started, reply: reply.slice(0, 80) };
  }

  // ---- Background job -------------------------------------------------------

  private async logActivity(entry: { runId: string; taskType: string; entityType?: string; entityId?: string; entityLabel?: string; status: string; summary?: string; errorMessage?: string; model?: string; durationMs?: number }) {
    await (prisma as any).aiActivityLog.create({ data: entry });
  }

  private async markRun(configId: string, status: string, message: string) {
    await (prisma as any).aiConfig.update({
      where: { id: configId },
      data: { lastRunAt: new Date(), lastRunStatus: status, lastRunMessage: message.slice(0, 500) },
    });
  }

  /**
   * Runs the enabled routine tasks. Each item is processed independently; one
   * failing LLM call never aborts the whole run. Returns per-task counters.
   */
  async runAssistedTasks(userId = 'system'): Promise<{ runId: string; triageNotes: number; knowledgeDrafts: number; skipped: number; failed: number }> {
    const config = await this.ensureConfig();
    if (!config.enabled) throw new AppError('AI assistant is disabled', 409);
    const endpoint = await this.resolveClient();
    const runId = crypto.randomUUID();
    const since = new Date(Date.now() - LOOKBACK_MS);
    let triageNotes = 0;
    let knowledgeDrafts = 0;
    let skipped = 0;
    let failed = 0;

    if (config.summarizeTickets) {
      const tickets = await prisma.ticket.findMany({
        where: {
          isArchived: false,
          openedAt: { gte: since },
          status: { notIn: ['closed', 'cancelled'] },
          comments: { none: { isInternal: true } },
        },
        orderBy: { openedAt: 'asc' },
        take: MAX_ITEMS_PER_TASK,
        include: { assets: { include: { asset: { select: { displayId: true, name: true } } } } },
      });

      for (const ticket of tickets) {
        const started = Date.now();
        try {
          const assetList = (ticket.assets ?? []).map((link: any) => `${link.asset?.displayId ?? ''} ${link.asset?.name ?? ''}`.trim()).join(', ');
          const note = await this.chat(endpoint, [
            { role: 'system', content: 'You are an IT service management assistant. Reply in plain text with 3-6 short bullet points: likely cause, missing information, suggested next steps for the engineer. Do not invent facts.' },
            { role: 'user', content: `Ticket ${ticket.displayId} (${ticket.type}, priority ${ticket.priority}, impact ${ticket.impact}, urgency ${ticket.urgency})\nTitle: ${ticket.title}\nDescription: ${ticket.description || '(none)'}\nAffected assets: ${assetList || '(none)'}` },
          ], { temperature: config.temperature, maxTokens: config.maxTokens });

          const comment = await prisma.$transaction(async (tx: any) => tx.ticketComment.create({
            data: {
              ticketId: ticket.id,
              authorId: null,
              body: `AI triage note (assistant draft)\n\n${note}`,
              isInternal: true,
            },
          }));
          triageNotes += 1;
          await this.logActivity({
            runId, taskType: 'ticket_triage_note', entityType: 'Ticket', entityId: ticket.id,
            entityLabel: `${ticket.displayId} — ${ticket.title}`.slice(0, 300), status: 'success',
            summary: `Added internal triage note (${comment.id})`, model: endpoint.model, durationMs: Date.now() - started,
          });
        } catch (error: any) {
          failed += 1;
          await this.logActivity({
            runId, taskType: 'ticket_triage_note', entityType: 'Ticket', entityId: ticket.id,
            entityLabel: `${ticket.displayId} — ${ticket.title}`.slice(0, 300), status: 'error',
            errorMessage: String(error?.message ?? error).slice(0, 500), model: endpoint.model, durationMs: Date.now() - started,
          });
        }
      }
    } else {
      skipped += 1;
    }

    if (config.knowledgeDrafts) {
      const resolvedIncidents = await prisma.ticket.findMany({
        where: {
          type: 'incident',
          isArchived: false,
          resolvedAt: { gte: since },
          status: { in: ['resolved', 'closed'] },
        },
        orderBy: { resolvedAt: 'asc' },
        take: MAX_ITEMS_PER_TASK,
        include: {
          comments: { orderBy: { createdAt: 'asc' }, take: 20 },
          incident: true,
        },
      });

      for (const ticket of resolvedIncidents) {
        const started = Date.now();
        try {
          const alreadyDrafted = await (prisma as any).knowledgeArticle.findFirst({
            where: { relatedEntityType: 'ticket', relatedEntityId: ticket.id, isArchived: false },
            select: { id: true },
          });
          if (alreadyDrafted) {
            skipped += 1;
            await this.logActivity({
              runId, taskType: 'knowledge_draft', entityType: 'Ticket', entityId: ticket.id,
              entityLabel: `${ticket.displayId} — ${ticket.title}`.slice(0, 300), status: 'skipped',
              summary: 'A knowledge draft already exists for this incident', model: endpoint.model, durationMs: Date.now() - started,
            });
            continue;
          }

          const notes = (ticket.comments ?? []).map((c: any) => `${c.isInternal ? '[internal]' : '[requester]'} ${c.body}`).join('\n').slice(0, 6000);
          const raw = await this.chat(endpoint, [
            { role: 'system', content: 'You are an IT knowledge manager. From the incident record, write a reusable knowledge article. Reply in strict JSON: {"title": string (max 200 chars), "summary": string (max 400 chars), "content": markdown with sections Problem, Symptoms, Root Cause, Resolution, Prevention}. Base it only on the given facts; omit unknown sections.' },
            { role: 'user', content: `Incident ${ticket.displayId} (${ticket.type}, priority ${ticket.priority})\nTitle: ${ticket.title}\nDescription: ${ticket.description || '(none)'}\nResolution notes / comments:\n${notes || '(none)'}` },
          ], { temperature: config.temperature, maxTokens: config.maxTokens });

          const parsed = this.parseArticleJson(raw);
          const article = await prisma.$transaction(async (tx: any) => {
            const displayId = await nextDisplayId(tx, 'KnowledgeArticle');
            return tx.knowledgeArticle.create({
              data: {
                displayId,
                title: parsed.title.slice(0, 250),
                summary: parsed.summary?.slice(0, 500) || null,
                content: parsed.content,
                category: 'incident',
                tags: ['ai-draft'],
                status: 'draft',
                authorId: null,
                relatedEntityType: 'ticket',
                relatedEntityId: ticket.id,
                createdBy: userId,
              },
            });
          });
          knowledgeDrafts += 1;
          await this.logActivity({
            runId, taskType: 'knowledge_draft', entityType: 'KnowledgeArticle', entityId: article.id,
            entityLabel: `${article.displayId} — ${article.title}`.slice(0, 300), status: 'success',
            summary: `Created draft KB article from ${ticket.displayId}`, model: endpoint.model, durationMs: Date.now() - started,
          });
        } catch (error: any) {
          failed += 1;
          await this.logActivity({
            runId, taskType: 'knowledge_draft', entityType: 'Ticket', entityId: ticket.id,
            entityLabel: `${ticket.displayId} — ${ticket.title}`.slice(0, 300), status: 'error',
            errorMessage: String(error?.message ?? error).slice(0, 500), model: endpoint.model, durationMs: Date.now() - started,
          });
        }
      }
    } else {
      skipped += 1;
    }

    const message = `triage notes: ${triageNotes}, knowledge drafts: ${knowledgeDrafts}, skipped: ${skipped}, failed: ${failed}`;
    await this.markRun(config.id, failed > 0 ? 'partial' : 'success', message);
    await auditService.logEventStandalone(prisma, {
      userId,
      action: 'CONFIG_CHANGE',
      entityType: 'AiAssistantRun',
      entityId: runId,
      details: `AI assistant run completed: ${message}`,
    });
    return { runId, triageNotes, knowledgeDrafts, skipped, failed };
  }

  /** Accept the model's JSON object; tolerate fenced code blocks. */
  private parseArticleJson(raw: string): { title: string; summary?: string; content: string } {
    const cleaned = String(raw).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    let parsed: AnyObject;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start === -1 || end <= start) throw new Error('Model did not return a JSON article object');
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    }
    const title = String(parsed.title ?? '').trim();
    const content = String(parsed.content ?? '').trim();
    if (!title || !content) throw new Error('Model response is missing title or content');
    return { title, summary: parsed.summary ? String(parsed.summary) : undefined, content };
  }

  /** Protocol of AI-assisted activity for the admin UI. */
  async listActivity(limit = 50) {
    const capped = Math.min(Math.max(Number(limit) || 50, 1), 500);
    return (prisma as any).aiActivityLog.findMany({ orderBy: { createdAt: 'desc' }, take: capped });
  }
}

export const aiService = new AiService();
