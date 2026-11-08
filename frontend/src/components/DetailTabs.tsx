/**
 * DetailTabs — accessible tab pattern for detail pages (Stage 10c / LT-5).
 *
 * Implements the WAI-ARIA tabs pattern with roving tabindex (`tabIndex=0` only
 * on the active tab) and ArrowLeft/ArrowRight/Home/End keyboard navigation.
 * Usable controlled (`activeTabId` + `onTabChange`) or uncontrolled
 * (`defaultTabId`); optional `?tab=` URL sync via `syncUrlParam` keeps
 * deep-linking possible without touching existing routes (reads the param on
 * mount and mirrors tab changes through history.replaceState — deliberately
 * no react-router dependency, so the component works in any context).
 *
 * Convention (docs/phase15-design-system.md): page-level tabs that belong to
 * the PageHeader render through its `tabs` slot with this component inside;
 * content tabs inside the page body use `DetailTabs` directly. One convention
 * per page — never both.
 *
 * Styling uses semantic tokens only: tablist `border-b border-border-subtle`,
 * active tab 2px `border-primary-600` underline + `text-text-primary`,
 * inactive `text-text-secondary hover:text-text-primary`, focus ring via
 * `focus-visible:ring-2 focus-visible:ring-focus-ring` with the
 * `ring-focus-ring-offset` offset token. No MUI.
 */
import { KeyboardEvent, ReactNode, useCallback, useRef, useState } from 'react';

export interface DetailTabItem {
  /** Stable machine id — used for aria wiring and optional URL sync. */
  id: string;
  /** Visible tab label. */
  label: ReactNode;
  /** Panel content rendered when the tab is active. */
  content: ReactNode;
  /** Disables the tab button (skipped by keyboard navigation). */
  disabled?: boolean;
}

export interface DetailTabsProps {
  tabs: DetailTabItem[];
  /** Initial tab for uncontrolled usage (falls back to the first enabled tab). */
  defaultTabId?: string;
  /** Controlled active tab id; when provided, state is owned by the caller. */
  activeTabId?: string;
  /** Notified on every user-driven tab change. */
  onTabChange?: (id: string) => void;
  /**
   * Optional deep-linking: syncs the active tab with `?tab=<id>` on the
   * current route without navigating away from it. Initial URL value wins
   * over `defaultTabId`. Default off.
   */
  syncUrlParam?: boolean;
  /** Accessible name of the tablist (e.g. "Asset details"). Recommended. */
  ariaLabel?: string;
  /** Extra classes merged onto the outer wrapper. */
  className?: string;
}

/** Stable per-instance prefix so aria ids never collide between tab groups. */
let tabUidCounter = 0;

export function DetailTabs({
  tabs,
  defaultTabId,
  activeTabId,
  onTabChange,
  syncUrlParam = false,
  ariaLabel,
  className,
}: DetailTabsProps) {
  const tablistRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [uid] = useState(() => `detail-tabs-${++tabUidCounter}`);

  const firstEnabled = tabs.find((tab) => !tab.disabled)?.id;
  const isControlled = activeTabId !== undefined;
  const [internalTab, setInternalTab] = useState<string>(() => {
    // Optional deep-linking: a ?tab= param on the current URL wins over
    // defaultTabId. Read once via the History API (no Router context needed).
    if (syncUrlParam) {
      try {
        const fromUrl = new URLSearchParams(window.location.search).get('tab');
        if (fromUrl && tabs.some((tab) => tab.id === fromUrl && !tab.disabled)) {
          return fromUrl;
        }
      } catch {
        // jsdom/edge environments without location access — fall through.
      }
    }
    return defaultTabId ?? firstEnabled ?? tabs[0]?.id ?? '';
  });

  const activeId = isControlled ? (activeTabId as string) : internalTab;

  const selectTab = useCallback(
    (id: string) => {
      if (!isControlled) setInternalTab(id);
      onTabChange?.(id);
      if (syncUrlParam) {
        try {
          const next = new URLSearchParams(window.location.search);
          next.set('tab', id);
          window.history.replaceState({}, '', `${window.location.pathname}?${next.toString()}`);
        } catch {
          // Deep-link mirroring is best-effort only.
        }
      }
    },
    [isControlled, onTabChange, syncUrlParam],
  );

  /** Roving-tabindex focus + activation for the given tab id. */
  const focusTab = useCallback(
    (id: string) => {
      buttonRefs.current[id]?.focus();
      selectTab(id);
    },
    [selectTab],
  );

  const enabledTabs = tabs.filter((tab) => !tab.disabled);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (!enabledTabs.length) return;
    const currentIndex = enabledTabs.findIndex((tab) => tab.id === activeId);
    let nextIndex: number;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = enabledTabs.length - 1;
    else if (event.key === 'ArrowRight') nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % enabledTabs.length;
    else nextIndex = currentIndex <= 0 ? enabledTabs.length - 1 : currentIndex - 1;
    focusTab(enabledTabs[nextIndex].id);
  };

  return (
    <div className={className}>
      <div
        ref={tablistRef}
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={handleKeyDown}
        className="-mb-px flex gap-6 overflow-x-auto border-b border-border-subtle"
      >
        {tabs.map((tab) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                buttonRefs.current[tab.id] = node;
              }}
              type="button"
              role="tab"
              id={`${uid}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${uid}-panel-${tab.id}`}
              aria-disabled={tab.disabled || undefined}
              disabled={tab.disabled}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-1 py-2 text-body2 font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ring-focus-ring-offset ${
                selected
                  ? 'border-primary-600 text-text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              } ${tab.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${uid}-panel-${tab.id}`}
          aria-labelledby={`${uid}-tab-${tab.id}`}
          tabIndex={0}
          hidden={tab.id !== activeId}
          className="pt-section-gap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ring-focus-ring-offset"
        >
          {tab.id === activeId ? tab.content : null}
        </div>
      ))}
    </div>
  );
}

export default DetailTabs;
