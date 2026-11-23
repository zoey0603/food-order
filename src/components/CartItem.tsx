import { useId, useState } from 'react';
import type { Product } from '../domain/order';
import { MAX_QUANTITY, formatPrice, parseQuantity } from '../domain/orderRules';

interface Props {
  product: Product;
  qty: number;
  onAdjust: (delta: 1 | -1) => void;
  onSetQuantity: (qty: number, expectedQty: number) => void;
  onRemove: () => void;
}

export function CartItem({ product, qty, onAdjust, onSetQuantity, onRemove }: Props) {
  const inputId = useId();
  const [draft, setDraft] = useState<{ text: string; expectedQty: number } | null>(null);
  const [showError, setShowError] = useState(false);
  const draftNumber = draft === null ? qty : parseQuantity(draft.text);

  function commitQuantity(revertInvalid = false) {
    if (draft === null) return;
    if (draftNumber === null) {
      setShowError(true);
      if (revertInvalid) setDraft(null);
      return;
    }
    setDraft(null);
    setShowError(false);
    if (draftNumber !== draft.expectedQty) onSetQuantity(draftNumber, draft.expectedQty);
  }

  return (
    <li className="cart-item">
      <span>{product.name}{product.soldOut && <small>已售完</small>}<small>{formatPrice(product.price * qty)}</small></span>
      <div className="cart-controls">
        <button type="button" aria-label={`減少${product.name}數量`} onClick={() => { setShowError(false); onAdjust(-1); }}>−</button>
        <label htmlFor={inputId} className="visually-hidden">{product.name}數量</label>
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={draft?.text ?? qty}
          aria-invalid={(showError && draft !== null) || undefined}
          aria-describedby={showError ? inputId + '-error' : undefined}
          onChange={event => {
            setShowError(false);
            setDraft({ text: event.currentTarget.value, expectedQty: draft?.expectedQty ?? qty });
          }}
          onBlur={() => commitQuantity(true)}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'Enter') {
              event.preventDefault();
              commitQuantity();
            }
            if (event.key === 'Escape') {
              setDraft(null);
              setShowError(false);
            }
          }}
        />
        <button type="button" aria-label={`增加${product.name}數量`} disabled={qty >= MAX_QUANTITY || product.soldOut} onClick={() => { setShowError(false); onAdjust(1); }}>+</button>
        <button type="button" aria-label={`移除${product.name}`} onClick={onRemove}>×</button>
      </div>
      {showError && <p id={inputId + '-error'} className="cart-quantity-error" role="status">
        數量請輸入 1 到 {MAX_QUANTITY} 的整數。{draft === null ? '已還原原數量。' : '按 Escape 可取消編輯。'}
      </p>}
    </li>
  );
}
