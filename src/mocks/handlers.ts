import { delay, http, HttpResponse } from 'msw';
import { appUrl } from '../api/paths';
import { products } from '../data/products';
import { ORDER_ID_PATTERN } from '../domain/demoOrder';
import { parseOrderRequest } from '../domain/demoOrderRules';
import { orderStore } from '../state/orderStore';

const productsUrl = appUrl('api/products');
const ordersUrl = appUrl('api/orders');
const failure = new URL(window.location.href).searchParams.get('mock');
let failureUsed = false;

function takeFailure(...modes: string[]) {
  if (failureUsed || !failure || !modes.includes(failure)) return null;
  failureUsed = true;
  return failure;
}

function error(status: number, message: string) {
  return HttpResponse.json({ message }, { status });
}

export const handlers = [
  http.get(productsUrl, async () => {
    await delay(250);
    if (takeFailure('products')) return error(503, '目前無法讀取商品，請重試。');
    return HttpResponse.json(products);
  }),
  http.post(ordersUrl, async ({ request }) => {
    await delay(450);
    const input = parseOrderRequest(await request.json().catch(() => null));
    if (!input) return error(422, '訂單資料有誤，請確認取餐資訊與購物車。');

    const simulate = takeFailure('http', 'network', 'response-lost');
    if (simulate === 'http') return error(503, '模擬服務暫時忙碌（HTTP 503），請重試。');
    if (simulate === 'network') return HttpResponse.error();

    const result = await orderStore.createDemoOrder(input);
    if (!result.ok) return error(503, '瀏覽器目前無法儲存示範訂單，請重試。');
    const outcome = result.value;
    if (outcome.status === 'changed') return error(409, '購物車或折扣已有變更，請確認最新摘要後再送出。');
    if (outcome.status === 'sold-out') return error(409, '購物車包含售完商品，請移除後再送出。');
    if (outcome.status === 'key-conflict') return error(409, '此送出識別已用於其他資料，請重新確認表單。');
    if (simulate === 'response-lost') return HttpResponse.error();
    return HttpResponse.json(outcome.order, { status: outcome.status === 'created' ? 201 : 200 });
  }),
  http.get(ordersUrl, async () => {
    await delay(250);
    if (takeFailure('orders')) return error(503, '目前無法讀取訂單紀錄，請重試。');
    try {
      return HttpResponse.json(await orderStore.listDemoOrders());
    } catch {
      return error(503, '目前無法讀取這個瀏覽器的示範訂單。');
    }
  }),
  http.get(ordersUrl + '/:id', async ({ params }) => {
    await delay(200);
    const id = typeof params.id === 'string' ? params.id : '';
    if (!ORDER_ID_PATTERN.test(id)) return error(404, '找不到這筆示範訂單。');
    try {
      const order = await orderStore.getDemoOrder(id);
      return order ? HttpResponse.json(order) : error(404, '找不到這筆示範訂單。');
    } catch {
      return error(503, '目前無法讀取這筆示範訂單。');
    }
  }),
];
