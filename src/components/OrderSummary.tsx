import type { DemoOrder } from '../domain/demoOrder';
import { formatPrice } from '../domain/orderRules';

export function OrderSummary({ items, totals }: Pick<DemoOrder, 'items' | 'totals'>) {
  return (
    <>
      <ul className="order-items" aria-label="訂購商品">
        {items.map(item => (
          <li key={item.id}>
            <span>{item.name} × {item.qty}</span><span>{formatPrice(item.price * item.qty)}</span>
          </li>
        ))}
      </ul>
      <dl className="receipt-totals">
        <div><dt>商品小計</dt><dd>{formatPrice(totals.subtotal)}</dd></div>
        <div><dt>滿額折扣</dt><dd>{formatPrice(totals.orderDiscount)}</dd></div>
        <div><dt>遊戲折扣</dt><dd>{formatPrice(totals.gameDiscount)}</dd></div>
        <div><dt>應付金額</dt><dd>{formatPrice(totals.total)}</dd></div>
      </dl>
    </>
  );
}
