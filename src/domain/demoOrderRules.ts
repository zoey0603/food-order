import { productsById } from '../data/products';
import { validateCheckout } from './demoOrder';
import type { DemoOrder, OrderRequest } from './demoOrder';
import type { CartItem, OrderState } from './order';
import { checkoutOrder, getTotals, MAX_QUANTITY } from './orderRules';
import type { Receipt } from './orderRules';

const totalKeys = ['subtotal', 'orderDiscount', 'gameDiscount', 'total', 'itemCount'] as const;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined;
}

export function parseOrderRequest(input: unknown): OrderRequest | null {
  const data = asRecord(input);
  if (!data || typeof data.requestId !== 'string' || !/^[a-f0-9]{32}$/.test(data.requestId)) return null;
  if (typeof data.name !== 'string' || typeof data.note !== 'string' || typeof data.dining !== 'string') return null;
  const fields = validateCheckout({ name: data.name, note: data.note, dining: data.dining }).value;
  if (!fields || !Array.isArray(data.cart) || !data.cart.length || data.cart.length > productsById.size) return null;

  const cart: CartItem[] = [];
  const ids = new Set<string>();
  for (const raw of data.cart) {
    const item = asRecord(raw);
    if (!item || typeof item.id !== 'string' || !productsById.has(item.id) || ids.has(item.id)
      || typeof item.qty !== 'number' || !Number.isSafeInteger(item.qty) || item.qty < 1 || item.qty > MAX_QUANTITY) return null;
    ids.add(item.id);
    cart.push({ id: item.id, qty: item.qty });
  }

  const totals = asRecord(data.totals);
  if (!totals || !totalKeys.every(key => typeof totals[key] === 'number' && Number.isSafeInteger(totals[key]) && totals[key] >= 0)) return null;
  return { ...fields, requestId: data.requestId, cart, totals: totals as unknown as Receipt };
}

function cartsMatch(actual: CartItem[], expected: CartItem[]) {
  return actual.length === expected.length
    && actual.every(line => expected.some(other => line.id === other.id && line.qty === other.qty));
}

function totalsMatch(actual: Receipt, expected: Receipt) {
  return totalKeys.every(key => actual[key] === expected[key]);
}

export type CreateOutcome =
  | { status: 'created'; order: DemoOrder }
  | { status: 'existing'; order: DemoOrder }
  | { status: 'changed' }
  | { status: 'sold-out' }
  | { status: 'key-conflict' };

export function createOrderFromCart(
  draft: OrderState,
  input: OrderRequest,
  existing?: DemoOrder,
): CreateOutcome {
  if (existing) {
    return existing.name === input.name && existing.note === input.note && existing.dining === input.dining
      && cartsMatch(existing.items, input.cart) && totalsMatch(existing.totals, input.totals)
      ? { status: 'existing', order: existing }
      : { status: 'key-conflict' };
  }
  if (!draft.cart.length || !cartsMatch(draft.cart, input.cart)
    || !totalsMatch(getTotals(draft.cart, draft.game.bestDiscount), input.totals)) return { status: 'changed' };

  const items: DemoOrder['items'] = [];
  for (const line of draft.cart) {
    const product = productsById.get(line.id);
    if (!product || product.soldOut) return { status: 'sold-out' };
    items.push({ ...line, name: product.name, price: product.price });
  }
  const totals = checkoutOrder(draft);
  if (!totals) return { status: 'changed' };
  return {
    status: 'created',
    order: {
      id: 'FO-' + input.requestId.toUpperCase(),
      createdAt: new Date().toISOString(),
      status: 'received',
      name: input.name,
      dining: input.dining,
      note: input.note,
      items,
      totals,
    },
  };
}
