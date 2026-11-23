import type { Product } from '../domain/order';
import type { DemoOrder, OrderRequest } from '../domain/demoOrder';
import { appUrl } from './paths';

export class ApiError extends Error {
  constructor(message: string, readonly kind: 'startup' | 'network' | 'http', readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

let startup: Promise<void> | undefined;

function startDemoApi() {
  startup ??= import('../mocks/browser')
    .then(({ startWorker }) => startWorker())
    .catch(() => {
      startup = undefined;
      throw new ApiError('無法啟動模擬 API，請確認瀏覽器允許 Service Worker 後重試。', 'startup');
    });
  return startup;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  await startDemoApi();
  let response: Response;
  try {
    response = await fetch(appUrl(path), options);
  } catch (cause) {
    if (options?.signal?.aborted) throw cause;
    throw new ApiError('網路連線失敗，請確認連線後重試。', 'network');
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
      ? body.message : '模擬 API 暫時無法處理請求。';
    throw new ApiError(message, 'http', response.status);
  }
  if (body === null) throw new ApiError('模擬 API 回傳的資料格式有誤。', 'http', response.status);
  return body as T;
}

export const api = {
  products: (signal: AbortSignal) => request<Product[]>('api/products', { signal }),
  orders: (signal: AbortSignal) => request<DemoOrder[]>('api/orders', { signal }),
  order: (id: string, signal: AbortSignal) => request<DemoOrder>('api/orders/' + encodeURIComponent(id), { signal }),
  createOrder: (order: OrderRequest) => request<DemoOrder>('api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  }),
};
