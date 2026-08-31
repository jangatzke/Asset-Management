# Repository Notes

- Monorepo workspaces: `shared`, `backend`, `frontend`.
- Build validation: `npm run build --workspace shared`, then `backend`, then `frontend`.
- Prisma commands in `backend` require `DATABASE_URL`; migrations are deployed with `npm run db:deploy`.
- Ticket integrity: `TicketAsset` links multiple assets; requester, assignee and manager are optional `User` relations and must refer to active users when supplied. `ticket.service.ts` validates both user and asset references.
- E-mail-to-ticket: `emailGateway.service.ts` supports IMAP and Exchange Online OAuth2 (MSAL client credentials), maps inbound senders case-insensitively via `User.email`, deduplicates by RFC 822 `Message-ID`, and stores `EmailMessage` audit data. The scheduler uses `executeTrackedJob` for cluster-safe polling. Admin configuration is `/admin/email-gateway`; never return mailbox/SMTP secrets to clients.
- Focused ticket reference test: `DATABASE_URL=... npm test --workspace backend -- --runInBand src/__tests__/ticket.reference-validation.test.ts`.
