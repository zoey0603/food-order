import type { CartAction, OrderState } from '../domain/order';
import { applyCartAction, DAILY_LIMIT, normalizeOrder, scoreDiscount } from '../domain/orderRules';
import { createOrderFromCart } from '../domain/demoOrderRules';
import type { CreateOutcome } from '../domain/demoOrderRules';
import type { DemoOrder, OrderRequest } from '../domain/demoOrder';
import type { PendingGameResult } from './pendingGameResult';

export const ORDER_STORAGE_KEY = 'food-order-state';
type Change<T> = (draft: OrderState, savedRecord?: unknown) => T;
type SideRecord<T> = { key: string; value: (outcome: T) => unknown };
type OrderStorage = 'loading' | 'database' | 'local' | 'memory';
type CommitResult<T> = { ok: true; value: T } | { ok: false };

let snapshot = { state: normalizeOrder(undefined), storage: 'loading' as OrderStorage, storageError: false };
let tail: Promise<unknown> = Promise.resolve();
let databasePromise: Promise<IDBDatabase> | undefined;
let localAvailable = true;
const listeners = new Set<() => void>();
const DEMO_ORDER_PREFIX = 'demo-order:';

function publish(state: OrderState, storage = snapshot.storage, storageError = false) {
  snapshot = { state, storage, storageError };
  for (const listener of listeners) listener();
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const task = tail.then(operation);
  tail = task.catch(() => undefined);
  return task;
}

function parse(value: string | null): unknown {
  try {
    return value === null ? undefined : JSON.parse(value);
  } catch {
    return undefined;
  }
}

function readLocal(): OrderState {
  if (localAvailable) {
    try {
      const raw = localStorage.getItem(ORDER_STORAGE_KEY);
      if (raw !== null) return normalizeOrder(parse(raw));

      const discount = localStorage.getItem('gameDiscount');
      // The original gamePlayCount has no date.
      return normalizeOrder({
        cart: parse(localStorage.getItem('cartData')),
        game: { bestDiscount: /^\d+$/.test(discount ?? '') ? Number(discount) : 0 },
      });
    } catch {
      localAvailable = false;
    }
  }
  return normalizeOrder(snapshot.state);
}

function saveLocal(state: OrderState) {
  if (!localAvailable) return;
  try {
    const encoded = JSON.stringify(state);
    if (localStorage.getItem(ORDER_STORAGE_KEY) !== encoded) localStorage.setItem(ORDER_STORAGE_KEY, encoded);
  } catch {
    localAvailable = false;
  }
}

function openDatabase() {
  databasePromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('food-order', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('orders');
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = undefined;
      };
      database.onclose = () => { databasePromise = undefined; };
      resolve(database);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Order database is blocked.'));
  });
  return databasePromise;
}

async function transact<T>(fallback: OrderState, update: Change<T>, mode: IDBTransactionMode, record?: SideRecord<T>) {
  const database = await openDatabase();
  return new Promise<{ state: OrderState; value: T }>((resolve, reject) => {
    const transaction = database.transaction('orders', mode);
    const orders = transaction.objectStore('orders');
    const current = orders.get(ORDER_STORAGE_KEY);
    let state: OrderState;
    let value: T;

    function applyChange(savedRecord?: unknown) {
      try {
        state = normalizeOrder(current.result ?? fallback);
        value = update(state, savedRecord);
        if (mode === 'readwrite' && savedRecord === undefined) {
          orders.put(state, ORDER_STORAGE_KEY);
          const extra = record?.value(value);
          if (record && extra !== undefined) orders.add(extra, record.key);
        }
      } catch {
        transaction.abort();
      }
    }

    current.onsuccess = () => {
      if (!record) {
        applyChange();
        return;
      }
      // The checkout or game record commits together with the cart and discount.
      const existing = orders.get(record.key);
      existing.onsuccess = () => applyChange(existing.result);
    };
    transaction.oncomplete = () => resolve({ state, value });
    transaction.onabort = () => reject(transaction.error ?? new Error('Order transaction aborted.'));
  });
}

async function refresh() {
  const fallback = readLocal();
  if (snapshot.storage === 'loading' || snapshot.storage === 'database') {
    try {
      const { state } = await transact(fallback, () => undefined, 'readonly');
      publish(state, 'database');
      return;
    } catch {
      if (snapshot.storage === 'database') {
        publish(snapshot.state, 'database', true);
        return;
      }
    }
  }
  publish(fallback, localAvailable ? 'local' : 'memory');
}

function change<T>(update: Change<T>, options: { requiresDatabase?: boolean; record?: SideRecord<T> } = {}): Promise<CommitResult<T>> {
  return enqueue(async () => {
    if (snapshot.storage === 'loading') await refresh();
    if (snapshot.storage === 'database') {
      try {
        const { state, value } = await transact(readLocal(), update, 'readwrite', options.record);
        saveLocal(state);
        publish(state);
        return { ok: true, value };
      } catch {
        // A failed write must not bypass the committed database or appear successful.
        publish(snapshot.state, 'database', true);
        return { ok: false };
      }
    }

    if (options.requiresDatabase) return { ok: false };
    const state = readLocal();
    const value = update(state);
    saveLocal(state);
    publish(state, localAvailable ? 'local' : 'memory');
    return { ok: true, value };
  });
}

async function readOrders<T>(select: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = select(database.transaction('orders', 'readonly').objectStore('orders'));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const orderStore = {
  getSnapshot: () => snapshot,

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },

  refresh: () => enqueue(refresh),

  updateCart(action: CartAction) {
    return change(draft => {
      const { cart, qty, status } = applyCartAction(draft.cart, action);
      draft.cart = cart;
      return { qty, status };
    });
  },

  beginGame() {
    return change(draft => {
      if (draft.game.plays >= DAILY_LIMIT) return false;
      draft.game.plays++;
      return true;
    }, { requiresDatabase: true });
  },

  finishGame(result: PendingGameResult) {
    return change((draft, marker) => {
      if (marker === undefined) draft.game.bestDiscount = Math.max(draft.game.bestDiscount, scoreDiscount(result.score));
      return draft.game;
    }, { requiresDatabase: true, record: { key: 'settled-game:' + result.id, value: () => true } });
  },

  createDemoOrder(input: OrderRequest) {
    const id = 'FO-' + input.requestId.toUpperCase();
    return change<CreateOutcome>((draft, saved) => createOrderFromCart(draft, input, saved as DemoOrder | undefined), {
      requiresDatabase: true,
      record: { key: DEMO_ORDER_PREFIX + id, value: outcome => outcome.status === 'created' ? outcome.order : undefined },
    });
  },

  async listDemoOrders() {
    const range = IDBKeyRange.bound(DEMO_ORDER_PREFIX, DEMO_ORDER_PREFIX + '\uffff');
    const orders = await readOrders<DemoOrder[]>(store => store.getAll(range));
    return orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  getDemoOrder(id: string) {
    return readOrders<DemoOrder | undefined>(store => store.get(DEMO_ORDER_PREFIX + id));
  },
};
