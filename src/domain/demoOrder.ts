import type { CartItem } from './order';
import type { Receipt } from './orderRules';

export const NAME_LIMIT = 30;
export const NOTE_LIMIT = 120;
export const DEMO_PAYMENT = '現場付款（模擬）';
export const DEMO_STATUS = '已接單（模擬）';

export interface CheckoutFields {
  name: string;
  dining: '' | 'dine-in' | 'takeaway';
  note: string;
}

export type ValidCheckout = Omit<CheckoutFields, 'dining'> & { dining: 'dine-in' | 'takeaway' };
export type FieldErrors = Partial<Record<keyof CheckoutFields, string>>;

export interface OrderRequest extends ValidCheckout {
  requestId: string;
  cart: CartItem[];
  totals: Receipt;
}

export interface DemoOrder extends ValidCheckout {
  id: string;
  createdAt: string;
  status: 'received';
  items: { id: string; name: string; price: number; qty: number }[];
  totals: Receipt;
}

export function validateCheckout(input: { name: string; dining: string; note: string }) {
  const name = input.name.trim();
  const note = input.note.trim();
  const dining = input.dining;
  const errors: FieldErrors = {};
  if (!name) errors.name = '請輸入取餐姓名。';
  else if (name.length > NAME_LIMIT) errors.name = `取餐姓名請輸入 ${NAME_LIMIT} 字以內。`;
  if (note.length > NOTE_LIMIT) errors.note = `備註請輸入 ${NOTE_LIMIT} 字以內。`;

  if (dining !== 'dine-in' && dining !== 'takeaway') {
    errors.dining = '請選擇內用或外帶。';
    return { errors, value: null };
  }
  if (errors.name || errors.note) return { errors, value: null };
  return { errors, value: { name, note, dining } as ValidCheckout };
}

export function createRequestId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
}

export const ORDER_ID_PATTERN = /^FO-[A-F0-9]{32}$/;

export function diningLabel(dining: ValidCheckout['dining']) {
  return dining === 'dine-in' ? '內用' : '外帶';
}

const dateFormat = new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium', timeStyle: 'short' });
export function formatOrderDate(isoDate: string) {
  return dateFormat.format(new Date(isoDate));
}
