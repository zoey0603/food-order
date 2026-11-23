import { Link } from 'react-router';
import { formatPrice } from '../domain/orderRules';
import type { getTotals } from '../domain/orderRules';

interface Props {
  totals: ReturnType<typeof getTotals>;
  bestDiscount: number;
  checkoutDisabled: boolean;
  onCheckout: () => void;
}

export function CartSummary({ totals, bestDiscount, checkoutDisabled, onCheckout }: Props) {
  return (
    <>
      <div className="discount-area">
        <p>消費滿 NT$300 折 NT$30。</p>
        <p id="game-discount-text">遊戲折扣已折 {formatPrice(totals.gameDiscount)}（可用 {formatPrice(bestDiscount)}）</p>
        <Link className="back-link" to="/game">玩小遊戲拿折扣</Link>
      </div>

      <div className="cart-summary">
        <div>
          <p>商品小計 <span id="subtotal-price">{formatPrice(totals.subtotal)}</span></p>
          <p>滿額折扣 <span id="order-discount">{formatPrice(totals.orderDiscount)}</span></p>
          <p><strong>應付金額 <span id="total-price">{formatPrice(totals.total)}</span></strong></p>
        </div>
        <button type="button" className="glow-btn" disabled={checkoutDisabled} onClick={onCheckout}>結帳</button>
      </div>
    </>
  );
}
