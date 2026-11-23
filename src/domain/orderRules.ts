import { products, productsById } from '../data/products';
import type { CartAction, CartItem, OrderState } from './order';

export const MAX_QUANTITY = 99;
export const DAILY_LIMIT = 3;
export const ROUND_SECONDS = 10;
const DISCOUNT_PER_POINT = 5;
const MAX_GAME_DISCOUNT = 100;
const numberFormat = new Intl.NumberFormat('zh-TW');

export function formatPrice(amount: number) {
  return 'NT$' + numberFormat.format(amount);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

export function normalizeCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];

  const quantities = new Map<string, number>();
  for (const entry of value) {
    const line = asRecord(entry);
    const qty = line?.qty;
    if (!line || typeof qty !== 'number' || !Number.isSafeInteger(qty) || qty <= 0) continue;

    const id = Object.hasOwn(line, 'id')
      ? line.id
      : products.find(product => product.name === line.name)?.id;
    if (typeof id !== 'string' || !productsById.has(id)) continue;

    const previous = quantities.get(id) ?? 0;
    quantities.set(id, previous + Math.min(qty, MAX_QUANTITY - previous));
  }
  return Array.from(quantities, ([id, qty]) => ({ id, qty }));
}

function withQuantity(cart: CartItem[], id: string, qty: number): CartItem[] {
  if (!productsById.has(id) || !Number.isSafeInteger(qty) || qty < 0) return cart;
  if (qty === 0) return cart.filter(line => line.id !== id);

  const next = { id, qty: Math.min(qty, MAX_QUANTITY) };
  return cart.some(line => line.id === id)
    ? cart.map(line => line.id === id ? next : line)
    : [...cart, next];
}

export function applyCartAction(cart: CartItem[], action: CartAction): {
  cart: CartItem[]; qty: number; status: 'updated' | 'conflict' | 'sold-out';
} {
  if (action.type === 'clear') return { cart: [], qty: 0, status: 'updated' };
  const qty = cart.find(line => line.id === action.id)?.qty ?? 0;
  if (action.type !== 'add' && qty === 0) return { cart, qty, status: 'conflict' } as const;
  if (action.type === 'set' && action.expectedQty !== qty) return { cart, qty, status: 'conflict' } as const;

  let nextQty = qty;
  switch (action.type) {
    case 'add': nextQty++; break;
    case 'adjust': nextQty += action.delta; break;
    case 'set': nextQty = action.qty; break;
    case 'remove': nextQty = 0; break;
  }
  if (nextQty > qty && productsById.get(action.id)?.soldOut) {
    return { cart, qty, status: 'sold-out' } as const;
  }
  const next = withQuantity(cart, action.id, nextQty);
  return { cart: next, qty: next.find(line => line.id === action.id)?.qty ?? 0, status: 'updated' } as const;
}

export function parseQuantity(value: string) {
  const digits = value.trim().replace(/[０-９]/g, digit => String(digit.charCodeAt(0) - 0xff10));
  const qty = /^\d{1,2}$/.test(digits) ? Number(digits) : 0;
  return qty >= 1 && qty <= MAX_QUANTITY ? qty : null;
}

function validDiscount(amount: unknown): number {
  return typeof amount === 'number' && Number.isInteger(amount) && amount > 0
    && amount <= MAX_GAME_DISCOUNT && amount % DISCOUNT_PER_POINT === 0 ? amount : 0;
}

export function getTotals(cart: CartItem[], bestDiscount: number) {
  let subtotal = 0;
  let itemCount = 0;
  for (const { id, qty } of normalizeCart(cart)) {
    subtotal += (productsById.get(id)?.price ?? 0) * qty;
    itemCount += qty;
  }

  const orderDiscount = subtotal >= 300 ? 30 : 0;
  const gameDiscount = Math.min(validDiscount(bestDiscount), subtotal - orderDiscount);
  return { subtotal, orderDiscount, gameDiscount, total: subtotal - orderDiscount - gameDiscount, itemCount };
}

export function scoreDiscount(score: number) {
  return Number.isSafeInteger(score) && score > 0 ? Math.min(score * DISCOUNT_PER_POINT, MAX_GAME_DISCOUNT) : 0;
}

export function checkoutOrder(state: OrderState) {
  const receipt = getTotals(state.cart, state.game.bestDiscount);
  if (!receipt.itemCount) return null;
  state.cart = [];
  state.game.bestDiscount = 0;
  return receipt;
}

export type Receipt = NonNullable<ReturnType<typeof checkoutOrder>>;

export function localDate(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return [now.getFullYear(), month, day].join('-');
}

export function normalizeOrder(input: unknown, now = new Date()): OrderState {
  const saved = asRecord(input);
  const game = asRecord(saved?.game);
  const date = localDate(now);
  const count = game?.plays;
  const plays = game?.date === date && typeof count === 'number' && Number.isSafeInteger(count) && count > 0
    ? Math.min(count, DAILY_LIMIT)
    : 0;
  return {
    cart: normalizeCart(saved?.cart),
    game: { date, plays, bestDiscount: validDiscount(game?.bestDiscount) },
  };
}
