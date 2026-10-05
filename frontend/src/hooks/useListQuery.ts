import { useCallback, useEffect, useRef } from 'react';

/**
 * Guard against out-of-order / stale list responses.
 *
 * Only the most recent request may update state: every new run() aborts the
 * in-flight request and marks it as superseded, so late-arriving responses are
 * discarded instead of overwriting newer data. Aborted requests never surface
 * as errors (matching the pattern previously duplicated in Assets.tsx).
 */
export interface ListQueryHandlers<T> {
  onSuccess: (data: T) => void;
  /** Called for genuine failures only (stale and aborted requests are silent). */
  onError?: (error: unknown) => void;
  /** Always runs after a non-stale request settles (e.g. clear loading state). */
  onSettled?: () => void;
}

export function useListQuery() {
  const latestRequestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Abort any in-flight request when the consuming component unmounts.
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const run = useCallback(async <T,>(
    request: (signal: AbortSignal) => Promise<T>,
    handlers: ListQueryHandlers<T>,
  ): Promise<void> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;

    const isStale = () => requestId !== latestRequestId.current;

    try {
      const data = await request(controller.signal);
      if (isStale()) return;
      handlers.onSuccess(data);
    } catch (error) {
      if (isStale()) return;
      // Aborted requests (superseded or unmount) are silent by design.
      if ((error as { name?: string })?.name === 'CanceledError' || controller.signal.aborted) return;
      handlers.onError?.(error);
    } finally {
      if (!isStale() && !controller.signal.aborted) handlers.onSettled?.();
    }
  }, []);

  return { run };
}
