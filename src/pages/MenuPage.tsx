import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CartItem } from '../components/CartItem';
import { CartSummary } from '../components/CartSummary';
import { CheckoutForm } from '../components/CheckoutForm';
import { CheckoutModal, ProductModal } from '../components/Modal';
import { CategoryFilter, ProductList } from '../components/ProductList';
import { Snow } from '../components/Snow';
import { api } from '../api/client';
import { useApiResource } from '../api/useApiResource';
import { productsById } from '../data/products';
import type { CartAction, CategoryFilter as Filter, Product } from '../domain/order';
import type { DemoOrder } from '../domain/demoOrder';
import { formatPrice, MAX_QUANTITY } from '../domain/orderRules';
import { useOrder } from '../state/OrderContext';

export function MenuPage({ category, onCategoryChange }: {
  category: Filter;
  onCategoryChange: (category: Filter) => void;
}) {
  const { state, totals, ready, canPersist, storageError, updateCart, placeOrder } = useOrder();
  const catalog = useApiResource(api.products);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('featured');
  const [preview, setPreview] = useState<{ product: Product; id: number } | null>(null);
  const previewSequence = useRef(0);
  const [receipt, setReceipt] = useState<DemoOrder | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [notice, setNotice] = useState('');
  const cart = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const checkoutTrigger = useRef<HTMLElement | null>(null);
  const focusedCartControl = useRef<Element | null>(null);

  const hasItems = state.cart.length > 0;
  const soldOut = state.cart.some(line => productsById.get(line.id)?.soldOut);
  const query = search.trim().toLocaleLowerCase('zh-TW');
  const visibleProducts = catalog.result.status === 'success' ? catalog.result.value.filter(product => (
    (category === 'all' || product.category.includes(category))
    && `${product.name} ${product.description}`.toLocaleLowerCase('zh-TW').includes(query)
  )) : [];
  if (sort === 'price-asc') visibleProducts.sort((a, b) => a.price - b.price);
  if (sort === 'price-desc') visibleProducts.sort((a, b) => b.price - a.price);

  useEffect(() => {
    document.documentElement.classList.toggle('has-cart-bar', hasItems);
    return () => document.documentElement.classList.remove('has-cart-bar');
  }, [hasItems]);

  useLayoutEffect(() => {
    const control = focusedCartControl.current;
    if (control && !control.isConnected) {
      if (document.activeElement === document.body) cart.current?.focus({ preventScroll: true });
      focusedCartControl.current = null;
    }
  }, [state.cart]);

  async function updateLine(product: Product, action: CartAction) {
    const previousFocus = document.activeElement;
    if (previousFocus && cart.current?.contains(previousFocus)) focusedCartControl.current = previousFocus;
    setNotice('');
    setAnnouncement('');
    const result = await updateCart(action);
    if (!result.ok) {
      setNotice('目前無法更新購物車，請重試。');
      return;
    }
    const { qty, status } = result.value;
    if (status === 'sold-out') {
      setNotice(`${product.name}目前已售完。`);
      return;
    }
    if (status === 'conflict') {
      setNotice(`${product.name}的購物車資料已有更新，請確認目前的數量。`);
      return;
    }
    setAnnouncement(qty
      ? `${product.name}在購物車內共 ${qty} 件${qty === MAX_QUANTITY ? '，已達數量上限' : ''}。`
      : `已移除${product.name}。`);
  }

  async function clearCart() {
    if (!hasItems) return;
    focusedCartControl.current = document.activeElement;
    setNotice('');
    setAnnouncement('');
    const result = await updateCart({ type: 'clear' });
    if (result.ok) setAnnouncement('已清空購物車。');
    else setNotice('目前無法清空購物車，請重試。');
  }

  function openCheckout() {
    if (!ready || !hasItems || soldOut) return;
    checkoutTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCheckoutOpen(true);
  }

  function cancelCheckout() {
    setCheckoutOpen(false);
    if (hasItems) checkoutTrigger.current?.focus({ preventScroll: true });
    else cart.current?.focus({ preventScroll: true });
  }

  function closeCheckout() {
    setReceipt(null);
    heading.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function showCart() {
    cart.current?.focus({ preventScroll: true });
    cart.current?.scrollIntoView({ block: 'start' });
  }

  return (
    <>
      <div className="layout">
        <section className="menu-section slide-in" aria-labelledby="menu-title">
          <h1 ref={heading} id="menu-title" tabIndex={-1}>今日菜單</h1>
          <div className="catalog-controls">
            <label>搜尋商品
              <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="輸入品名或描述" />
            </label>
            <label>商品排序
              <select value={sort} onChange={event => setSort(event.target.value)}>
                <option value="featured">預設順序</option>
                <option value="price-asc">價格由低到高</option>
                <option value="price-desc">價格由高到低</option>
              </select>
            </label>
          </div>
          <CategoryFilter selected={category} onChange={onCategoryChange} />
          {catalog.result.status === 'loading' && <p role="status" className="resource-state">正在載入菜單…</p>}
          {catalog.result.status === 'error' && (
            <div className="resource-state"><p role="alert">{catalog.result.error.message}</p>
              <button type="button" className="secondary-btn" onClick={catalog.retry}>重新載入菜單</button>
            </div>
          )}
          {catalog.result.status === 'success' && (visibleProducts.length ? (
            <ProductList
              products={visibleProducts}
              disabled={!ready}
              onAdd={product => void updateLine(product, { type: 'add', id: product.id })}
              onPreview={product => setPreview({ product, id: ++previewSequence.current })}
            />
          ) : (
            <div className="resource-state">
              <p role="status">{catalog.result.value.length ? '找不到符合條件的商品。' : '目前沒有商品。'}</p>
              {(query || category !== 'all') && <button type="button" className="secondary-btn"
                onClick={() => { setSearch(''); onCategoryChange('all'); }}>清除搜尋與篩選</button>}
            </div>
          ))}
        </section>

        <aside ref={cart} id="cart" className="cart-section slide-in" aria-labelledby="cart-title" tabIndex={-1}>
          <h2 id="cart-title">購物車</h2>
          {!ready && <p className="cart-empty" role="status">讀取購物車中…</p>}
          {ready && !hasItems && <p className="cart-empty">購物車目前是空的。</p>}
          {hasItems && (
            <ul className="cart-items" role="list">
              {state.cart.map(line => {
                const product = productsById.get(line.id);
                return product && (
                  <CartItem
                    key={line.id}
                    product={product}
                    qty={line.qty}
                    onAdjust={delta => void updateLine(product, { type: 'adjust', id: line.id, delta })}
                    onSetQuantity={(qty, expectedQty) => void updateLine(product, { type: 'set', id: line.id, qty, expectedQty })}
                    onRemove={() => void updateLine(product, { type: 'remove', id: line.id })}
                  />
                );
              })}
            </ul>
          )}
          {hasItems && <button type="button" className="secondary-btn clear-cart" onClick={() => void clearCart()}>清空購物車</button>}
          {soldOut && <p role="status">購物車含售完商品，請移除後再結帳。</p>}
          <CartSummary
            totals={totals}
            bestDiscount={state.game.bestDiscount}
            checkoutDisabled={!ready || !hasItems || soldOut}
            onCheckout={openCheckout}
          />
          {!canPersist && <p className="storage-notice" role="status">購物車只能暫存在此頁，重新整理後可能會遺失。</p>}
          <p className="storage-notice" role="status" hidden={!notice && !storageError}>
            {notice || '目前無法讀取購物車的最新資料，請稍後重試。'}
          </p>
          <p className="cart-feedback" role="status">{announcement}</p>
        </aside>
      </div>

      <Snow />
      {hasItems && (
        <div className="mobile-cart-bar">
          <span>{totals.itemCount} 件商品 · {formatPrice(totals.total)}</span>
          <button type="button" onClick={showCart}>查看購物車</button>
        </div>
      )}
      {preview && (
        <ProductModal
          key={preview.id}
          product={preview.product}
          onClose={() => setPreview(current => current?.id === preview.id ? null : current)}
        />
      )}
      {checkoutOpen && (
        <CheckoutForm cart={state.cart} totals={totals} onSubmit={placeOrder}
          onSuccess={order => { setCheckoutOpen(false); setReceipt(order); }} onClose={cancelCheckout} />
      )}
      {receipt && <CheckoutModal order={receipt} onClose={closeCheckout} />}
    </>
  );
}
