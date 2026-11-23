import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { CartAction } from '../domain/order';
import type { DemoOrder, OrderRequest } from '../domain/demoOrder';
import { api } from '../api/client';
import { getTotals } from '../domain/orderRules';
import { ORDER_STORAGE_KEY, orderStore } from './orderStore';
import { createGameResult, forgetGameResult, readPendingGameResult, rememberGameResult } from './pendingGameResult';
import type { PendingGameResult } from './pendingGameResult';

type GameResult = PendingGameResult & { status: 'saving' | 'retry' | 'saved'; recoverable: boolean };

type OrderContextValue = ReturnType<typeof orderStore.getSnapshot> & {
  ready: boolean;
  canPlay: boolean;
  canPersist: boolean;
  totals: ReturnType<typeof getTotals>;
  updateCart: typeof orderStore.updateCart;
  beginGame: typeof orderStore.beginGame;
  gameResult: GameResult | null;
  saveGameResult: (score: number) => Promise<void>;
  retryGameResult: () => Promise<void>;
  clearGameResult: () => void;
  placeOrder: (input: OrderRequest) => Promise<DemoOrder>;
};

const OrderContext = createContext<OrderContextValue | null>(null);

export function OrderProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(orderStore.subscribe, orderStore.getSnapshot);
  const channel = useRef<BroadcastChannel | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(() => {
    const pending = readPendingGameResult();
    return pending && { ...pending, status: 'retry', recoverable: true };
  });
  const savingResult = useRef(false);

  useEffect(() => {
    let midnight: number;
    function refresh() {
      void orderStore.refresh();
    }
    function scheduleRefresh() {
      window.clearTimeout(midnight);
      refresh();
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      midnight = window.setTimeout(scheduleRefresh, tomorrow.getTime() - now.getTime());
    }
    function handleStorage(event: StorageEvent) {
      if (event.key === ORDER_STORAGE_KEY || event.key === null) refresh();
    }
    function handleVisibility() {
      if (!document.hidden) scheduleRefresh();
    }

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel.current = new BroadcastChannel('food-order-changes');
        channel.current.onmessage = refresh;
      } catch {
        channel.current = null;
      }
    }
    scheduleRefresh();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', scheduleRefresh);
    window.addEventListener('pageshow', scheduleRefresh);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      channel.current?.close();
      channel.current = null;
      window.clearTimeout(midnight);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', scheduleRefresh);
      window.removeEventListener('pageshow', scheduleRefresh);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const notify = useCallback(async <T extends { ok: boolean },>(operation: Promise<T>) => {
    const result = await operation;
    if (result.ok) channel.current?.postMessage(null);
    return result;
  }, []);

  const submitGameResult = useCallback(async (pending: PendingGameResult) => {
    if (savingResult.current) return;
    savingResult.current = true;
    const result = { id: pending.id, score: pending.score };
    const recoverable = rememberGameResult(result);
    setGameResult({ ...result, status: 'saving', recoverable });
    try {
      const committed = await notify(orderStore.finishGame(result));
      if (committed.ok) forgetGameResult(result.id);
      setGameResult({ ...result, status: committed.ok ? 'saved' : 'retry', recoverable });
    } catch {
      setGameResult({ ...result, status: 'retry', recoverable });
    } finally {
      savingResult.current = false;
    }
  }, [notify]);

  const saveGameResult = useCallback((score: number) => submitGameResult(createGameResult(score)), [submitGameResult]);
  async function retryGameResult() {
    if (gameResult?.status === 'retry') await submitGameResult(gameResult);
  }

  const actions = useMemo(() => ({
    updateCart: (action: CartAction) => notify(orderStore.updateCart(action)),
    beginGame: () => notify(orderStore.beginGame()),
    saveGameResult,
    clearGameResult: () => setGameResult(null),
    placeOrder: async (input: OrderRequest) => {
      const order = await api.createOrder(input);
      channel.current?.postMessage(null);
      return order;
    },
  }), [notify, saveGameResult]);

  const { state, storage } = snapshot;
  const value: OrderContextValue = {
    ...snapshot,
    ready: storage !== 'loading',
    canPlay: storage === 'database',
    canPersist: storage === 'database' || storage === 'local',
    gameResult,
    retryGameResult,
    totals: getTotals(state.cart, state.game.bestDiscount),
    ...actions,
  };

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrder() {
  const value = useContext(OrderContext);
  if (!value) throw new Error('useOrder must be used inside OrderProvider.');
  return value;
}
