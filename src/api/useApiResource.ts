import { useEffect, useState } from 'react';

type Resource<T> =
  | { status: 'loading' }
  | { status: 'success'; value: T }
  | { status: 'error'; error: Error };

export function useApiResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Resource<T>>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setResult({ status: 'loading' });
    async function fetchResource() {
      try {
        const value = await load(controller.signal);
        if (!controller.signal.aborted) setResult({ status: 'success', value });
      } catch (error) {
        if (!controller.signal.aborted) {
          setResult({ status: 'error', error: error instanceof Error ? error : new Error('無法讀取資料。') });
        }
      }
    }
    void fetchResource();
    return () => controller.abort();
  }, [load, attempt]);

  return { result, retry: () => setAttempt(current => current + 1) };
}
