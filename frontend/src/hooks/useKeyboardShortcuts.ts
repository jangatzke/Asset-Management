import { useEffect, useRef } from 'react';

export interface KeyboardShortcutBinding {
  /**
   * Key sequence to trigger the action, e.g. `['g', 'a']` for "go to Assets"
   * or `['g']` for a single-key binding. Keys are matched case-insensitively
   * and without modifiers.
   */
  sequence: string[];
  /** Optional predicate. When it returns false the shortcut is ignored. */
  when?: () => boolean;
  /** Handler invoked when the sequence completes. */
  onTrigger: (event: KeyboardEvent) => void;
}

/**
 * True when the event targets an editable element (input, textarea, select).
 * Prevents global shortcuts from hijacking typing.
 */
function isEditableTarget(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return ['Control', 'Alt', 'Shift', 'Meta', 'CapsLock'].includes(event.key);
}

/**
 * Global keyboard-shortcut manager.
 *
 * Registers a set of bindings (single-key or multi-key sequences) on the
 * document. Bindings are ignored while the user is typing in a field, while a
 * modifier key is held, or when the binding's `when()` returns false.
 *
 * Sequences are matched against a rolling buffer: after pressing `g` the next
 * key is appended and the buffer is checked for a completed sequence; a
 * non-matching key or a timeout (1s) resets the buffer.
 */
export function useKeyboardShortcuts(bindings: KeyboardShortcutBinding[], options: { when?: () => boolean } = {}) {
  const { when } = options;
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  const bufferRef = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const resetBuffer = () => {
      bufferRef.current = [];
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const findSequenceForPrefix = (prefix: string[]): boolean =>
      bindingsRef.current.some((b) => {
        if (b.sequence.length <= prefix.length) return false;
        return b.sequence.slice(0, prefix.length).every((k, i) => k === prefix[i]);
      });

    const completeSequence = (sequence: string[]): KeyboardShortcutBinding | undefined =>
      bindingsRef.current.find((b) => b.sequence.length === sequence.length &&
        b.sequence.every((k, i) => k === sequence[i]));

    const onKeyDown = (event: KeyboardEvent) => {
      // Ignore typing / modifier-only keys.
      if (isEditableTarget(event)) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (when && !when()) return;

      const key = event.key.toLowerCase();

      // Escape clears any pending sequence.
      if (key === 'escape') {
        resetBuffer();
        return;
      }

      // Only single-character keys participate in sequences.
      if (key.length !== 1) {
        resetBuffer();
        return;
      }

      const match = completeSequence([...bufferRef.current, key]);
      if (match) {
        event.preventDefault();
        resetBuffer();
        match.onTrigger(event);
        return;
      }

      // Extend the buffer if it still leads to a possible sequence.
      const extended = [...bufferRef.current, key];
      if (findSequenceForPrefix(extended)) {
        bufferRef.current = extended;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(resetBuffer, 1000);
        return;
      }

      // Dead end — restart the buffer with this key if it starts a sequence.
      const fresh = [key];
      if (findSequenceForPrefix(fresh) || completeSequence(fresh)) {
        bufferRef.current = fresh;
        timerRef.current = setTimeout(resetBuffer, 1000);
        return;
      }

      resetBuffer();
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      resetBuffer();
    };
  }, [when]);
}
