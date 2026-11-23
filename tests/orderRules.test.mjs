import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite;
let rules;
let pending;
let checkout;
let mockOrders;
const toast = 'cheese-toast';
const line = (qty, id = toast) => ({ id, qty });

before(async () => {
  vite = await createServer({ appType: 'custom', server: { middlewareMode: true, ws: false } });
  rules = await vite.ssrLoadModule('/src/domain/orderRules.ts');
  pending = await vite.ssrLoadModule('/src/state/pendingGameResult.ts');
  checkout = await vite.ssrLoadModule('/src/domain/demoOrder.ts');
  mockOrders = await vite.ssrLoadModule('/src/domain/demoOrderRules.ts');
});
after(() => vite?.close());

test('legacy name migration combines quantities and ignores untrusted prices', () => {
  const cart = rules.normalizeCart([
    { name: '起司厚片', price: -100, qty: 2 },
    line(3), line(-2), line(9, 'missing'), null,
  ]);
  assert.deepEqual(cart, [line(5)]);
  assert.equal(rules.getTotals(cart, 0).subtotal, 300);
});

test('only an explicit add can create a missing line', () => {
  for (const action of [
    { type: 'adjust', id: toast, delta: 1 },
    { type: 'set', id: toast, qty: 4, expectedQty: 1 },
    { type: 'remove', id: toast },
  ]) {
    const result = rules.applyCartAction([], action);
    assert.equal(result.status, 'conflict');
    assert.deepEqual(result.cart, []);
  }
  assert.deepEqual(rules.applyCartAction([], { type: 'add', id: toast }).cart, [line(1)]);
});

test('an old quantity draft cannot overwrite a concurrent update', () => {
  const cart = [line(2)];
  const result = rules.applyCartAction(cart, { type: 'set', id: toast, qty: 5, expectedQty: 1 });
  assert.equal(result.status, 'conflict');
  assert.equal(result.qty, 2);
  assert.deepEqual(result.cart, cart);
});

test('valid edits replace the quantity, increments cap at 99 and decrement to zero removes the line', () => {
  const set = rules.applyCartAction([line(2)], { type: 'set', id: toast, qty: 99, expectedQty: 2 });
  assert.deepEqual(set.cart, [line(99)]);
  assert.equal(rules.applyCartAction(set.cart, { type: 'add', id: toast }).qty, 99);
  assert.deepEqual(rules.applyCartAction([line(1)], { type: 'adjust', id: toast, delta: -1 }).cart, []);
});

test('quantity parsing supports fullwidth input and rejects invalid values', () => {
  assert.equal(rules.parseQuantity(' ３ '), 3);
  for (const value of ['', '0', '-2', '2.5', '1e1', '100', 'NaN']) {
    assert.equal(rules.parseQuantity(value), null, value);
  }
});

test('order discount boundary and game discount are calculated independently', () => {
  assert.deepEqual(rules.getTotals([line(4)], 100), {
    subtotal: 240, itemCount: 4, orderDiscount: 0, gameDiscount: 100, total: 140,
  });
  assert.deepEqual(rules.getTotals([line(5)], 100), {
    subtotal: 300, itemCount: 5, orderDiscount: 30, gameDiscount: 100, total: 170,
  });
});

test('the payable amount stays nonnegative and invalid discounts are rejected', () => {
  assert.equal(rules.getTotals([line(1, 'black-tea')], 100).total, 0);
  for (const value of [NaN, -5, 7, 500]) {
    assert.equal(rules.getTotals([line(1)], value).total, 60);
  }
  assert.equal(rules.scoreDiscount(2), 10);
  assert.equal(rules.scoreDiscount(22), 100);
});

test('local midnight resets attempts and carries forward an unused discount', () => {
  const yesterday = new Date(2026, 10, 23, 23, 59);
  const today = new Date(2026, 10, 24, 0, 1);
  const state = { game: { date: rules.localDate(yesterday), plays: 3, bestDiscount: 40 } };
  assert.equal(rules.normalizeOrder(state, yesterday).game.plays, 3);
  assert.deepEqual(rules.normalizeOrder(state, today).game, {
    date: rules.localDate(today), plays: 0, bestDiscount: 40,
  });
});

test('checkout snapshots the applied totals and keeps the daily game count', () => {
  const state = { cart: [line(5)], game: { date: '2026-11-23', plays: 3, bestDiscount: 100 } };
  const receipt = rules.checkoutOrder(state);
  assert.equal(receipt.total, 170);
  assert.equal(receipt.itemCount, 5);
  assert.deepEqual(state, { cart: [], game: { date: '2026-11-23', plays: 3, bestDiscount: 0 } });
  assert.equal(rules.checkoutOrder(state), null);
});

function withSessionStorage(storage, run) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', { value: storage, configurable: true });
  try {
    run();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'sessionStorage', descriptor);
    else delete globalThis.sessionStorage;
  }
}

test('pending result preserves its id and score until the matching committed result is removed', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  withSessionStorage(storage, () => {
    const result = pending.createGameResult(22);
    assert.match(result.id, /^[a-f0-9]{32}$/);
    assert.equal(pending.rememberGameResult(result), true);
    assert.deepEqual(pending.readPendingGameResult(), result);
    pending.forgetGameResult(pending.createGameResult(1).id);
    assert.deepEqual(pending.readPendingGameResult(), result);
    pending.forgetGameResult(result.id);
    assert.equal(pending.readPendingGameResult(), null);
  });
});

test('damaged pending payloads and unavailable session storage fail safely', () => {
  const id = 'a'.repeat(32);
  for (const raw of ['{', JSON.stringify({ id: 'unknown', score: 9 }), JSON.stringify({ id, score: -1 }),
    JSON.stringify({ id, score: 2.5 }), JSON.stringify({ id, score: '2' })]) {
    withSessionStorage({ getItem: () => raw }, () => assert.equal(pending.readPendingGameResult(), null));
  }
  const blocked = () => { throw new Error('Session storage unavailable'); };
  withSessionStorage({ getItem: blocked, setItem: blocked }, () => {
    assert.equal(pending.readPendingGameResult(), null);
    assert.equal(pending.rememberGameResult({ id, score: 2 }), false);
  });
});

test('checkout trims fields and rejects blank names, invalid dining and oversized values', () => {
  assert.deepEqual(checkout.validateCheckout({ name: ' 阿明 ', dining: 'takeaway', note: ' 少冰 ' }).value,
    { name: '阿明', dining: 'takeaway', note: '少冰' });
  const rejected = checkout.validateCheckout({ name: '  ', dining: 'other', note: 'x'.repeat(121) });
  assert.deepEqual(Object.keys(rejected.errors).sort(), ['dining', 'name', 'note']);
  assert.equal(checkout.validateCheckout({ name: 'a'.repeat(31), dining: 'dine-in', note: '' }).value, null);
});

function demoRequest(state) {
  return { requestId: 'a'.repeat(32), name: '阿明', dining: 'takeaway', note: '',
    cart: state.cart.slice(), totals: rules.getTotals(state.cart, state.game.bestDiscount) };
}

test('mock request validation rejects duplicate lines, empty carts and invalid quantities', () => {
  const state = { cart: [line(2)], game: { bestDiscount: 0 } };
  const valid = demoRequest(state);
  assert.deepEqual(mockOrders.parseOrderRequest(valid), valid);
  for (const cart of [[], [line(1), line(1)], [line(100)], [line(1, 'missing')]]) {
    assert.equal(mockOrders.parseOrderRequest({ ...valid, cart }), null);
  }
});

test('mock order snapshots the quoted prices and replay leaves a newly added cart intact', () => {
  const state = { cart: [line(5)], game: { date: '2026-11-23', plays: 2, bestDiscount: 100 } };
  const input = demoRequest(state);
  const result = mockOrders.createOrderFromCart(state, input);
  assert.equal(result.status, 'created');
  assert.equal(result.order.totals.total, 170);
  assert.equal(result.order.items[0].price, 60);
  assert.deepEqual(state, { cart: [], game: { date: '2026-11-23', plays: 2, bestDiscount: 0 } });
  state.cart = [line(2)];
  assert.equal(mockOrders.createOrderFromCart(state, input, result.order).status, 'existing');
  assert.equal(mockOrders.createOrderFromCart(state, { ...input, name: '小明' }, result.order).status, 'key-conflict');
  assert.deepEqual(state.cart, [line(2)]);
});

test('outdated totals and sold-out products cannot consume a cart or discount', () => {
  const state = { cart: [line(1)], game: { bestDiscount: 15 } };
  const input = demoRequest(state);
  const wrong = { ...input, totals: { ...input.totals, total: 0 } };
  assert.equal(mockOrders.createOrderFromCart(state, wrong).status, 'changed');
  assert.equal(state.game.bestDiscount, 15);
  const id = 'jasmine-green-tea';
  assert.equal(rules.applyCartAction([], { type: 'add', id }).status, 'sold-out');
  state.cart = [line(1, id)];
  assert.equal(mockOrders.createOrderFromCart(state, demoRequest(state)).status, 'sold-out');
  assert.deepEqual(state.cart, [line(1, id)]);
  assert.deepEqual(rules.applyCartAction(state.cart, { type: 'clear' }).cart, []);
});
