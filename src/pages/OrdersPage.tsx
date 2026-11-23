import { useCallback } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError, api } from '../api/client';
import { useApiResource } from '../api/useApiResource';
import { OrderSummary } from '../components/OrderSummary';
import { DEMO_PAYMENT, DEMO_STATUS, diningLabel, formatOrderDate } from '../domain/demoOrder';
import { formatPrice } from '../domain/orderRules';

function OrderError({ error, retry }: { error: Error; retry: () => void }) {
  const missing = error instanceof ApiError && error.status === 404;
  return (
    <div className="resource-state">
      <p role="alert">{error.message}</p>
      {!missing && <button className="secondary-btn" type="button" onClick={retry}>重新載入</button>}
    </div>
  );
}

export function OrdersPage() {
  const { result, retry } = useApiResource(api.orders);
  return (
    <section className="page-container orders-page">
      <h1 tabIndex={-1}>訂單紀錄</h1>
      <p className="order-context">查看目前瀏覽器的示範訂單。</p>
      {result.status === 'loading' && <p className="resource-state" role="status">正在載入訂單…</p>}
      {result.status === 'error' && <OrderError error={result.error} retry={retry} />}
      {result.status === 'success' && (result.value.length ? (
        <ul className="order-history">
          {result.value.map(order => (
            <li className="history-card" key={order.id}>
              <div className="history-heading">
                <h2 className="order-code">{order.id}</h2>
                <span className="order-status">{DEMO_STATUS}</span>
              </div>
              <p><time dateTime={order.createdAt}>{formatOrderDate(order.createdAt)}</time> · {diningLabel(order.dining)}</p>
              <p className="history-items">{order.items.map(item => `${item.name} × ${item.qty}`).join('、')}</p>
              <p>滿額折扣 {formatPrice(order.totals.orderDiscount)} · 遊戲折扣 {formatPrice(order.totals.gameDiscount)}</p>
              <p><strong>應付 {formatPrice(order.totals.total)}</strong></p>
              <Link className="back-link" to={`/orders/${order.id}`}>查看訂單詳情<span className="visually-hidden"> {order.id}</span></Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="resource-state">
          <p role="status">目前沒有示範訂單。</p>
          <Link className="back-link" to="/">前往菜單</Link>
        </div>
      ))}
    </section>
  );
}

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const loadOrder = useCallback((signal: AbortSignal) => api.order(id, signal), [id]);
  const { result, retry } = useApiResource(loadOrder);

  return (
    <section className="page-container orders-page">
      <h1 tabIndex={-1}>訂單詳情</h1>
      <Link className="back-link" to="/orders">返回訂單紀錄</Link>
      {result.status === 'loading' && <p className="resource-state" role="status">正在載入訂單…</p>}
      {result.status === 'error' && <OrderError error={result.error} retry={retry} />}
      {result.status === 'success' && (
        <div className="history-card">
          <div className="history-heading">
            <h2 className="order-code">{result.value.id}</h2>
            <span className="order-status">{DEMO_STATUS}</span>
          </div>
          <dl className="order-details">
            <div><dt>下單時間</dt><dd><time dateTime={result.value.createdAt}>{formatOrderDate(result.value.createdAt)}</time></dd></div>
            <div><dt>取餐姓名</dt><dd>{result.value.name}</dd></div>
            <div><dt>用餐方式</dt><dd>{diningLabel(result.value.dining)}</dd></div>
            <div><dt>付款方式</dt><dd>{DEMO_PAYMENT}</dd></div>
            {result.value.note && <div><dt>備註</dt><dd>{result.value.note}</dd></div>}
          </dl>
          <OrderSummary items={result.value.items} totals={result.value.totals} />
        </div>
      )}
    </section>
  );
}
