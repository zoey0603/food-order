import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Product } from '../domain/order';
import type { DemoOrder } from '../domain/demoOrder';
import { Link } from 'react-router';
import { formatPrice } from '../domain/orderRules';
import type { Receipt } from '../domain/orderRules';
import { ProductPhoto } from './ProductPhoto';

interface DialogProps {
  titleId: string;
  descriptionId?: string;
  className?: string;
  dismissible?: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ titleId, descriptionId, className, dismissible = true, onClose, children }: DialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className={className}
      onCancel={event => { if (!dismissible) event.preventDefault(); }}
      onClose={onClose}
      onClick={event => {
        if (dismissible && event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      {children}
    </dialog>
  );
}

export function CheckoutModal({ order, onClose }: { order: DemoOrder; onClose: () => void }) {
  const receipt: Receipt = order.totals;
  return (
    <Modal titleId="checkout-title" descriptionId="checkout-description" onClose={onClose}>
      <div className="modal-content">
        <h2 id="checkout-title">示範結帳完成</h2>
        <p id="checkout-description">共 {receipt.itemCount} 件商品。購物車已清空。</p>
        <p>訂單編號 <span className="order-code">{order.id}</span></p>
        <dl className="receipt-totals">
          <div><dt>商品小計</dt><dd>{formatPrice(receipt.subtotal)}</dd></div>
          <div><dt>滿額折扣</dt><dd>{formatPrice(receipt.orderDiscount)}</dd></div>
          <div><dt>遊戲折扣</dt><dd>{formatPrice(receipt.gameDiscount)}</dd></div>
          <div><dt>本次金額</dt><dd>{formatPrice(receipt.total)}</dd></div>
        </dl>
        <Link className="back-link" to={`/orders/${order.id}`}>查看訂單詳情</Link>
        <form method="dialog">
          <button type="submit" className="glow-btn">回到菜單頂部</button>
        </form>
      </div>
    </Modal>
  );
}

export function ProductModal({ product, onClose }: { product: Product; onClose: () => void }) {
  return (
    <Modal className="product-dialog" titleId="image-modal-title" onClose={onClose}>
      <div className="image-modal-content">
        <form method="dialog">
          <button type="submit" className="image-modal-close" aria-label="關閉餐點照片">×</button>
        </form>
        <ProductPhoto key={product.id} product={product} mode="preview" />
        <h2 id="image-modal-title">{product.name}</h2>
      </div>
    </Modal>
  );
}
