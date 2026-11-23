import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '../api/client';
import { productsById } from '../data/products';
import { createRequestId, DEMO_PAYMENT, NAME_LIMIT, NOTE_LIMIT, validateCheckout } from '../domain/demoOrder';
import type { CheckoutFields, DemoOrder, FieldErrors, OrderRequest } from '../domain/demoOrder';
import type { CartItem } from '../domain/order';
import type { Receipt } from '../domain/orderRules';
import { Modal } from './Modal';
import { OrderSummary } from './OrderSummary';

interface Props {
  cart: CartItem[];
  totals: Receipt;
  onSubmit: (request: OrderRequest) => Promise<DemoOrder>;
  onSuccess: (order: DemoOrder) => void;
  onClose: () => void;
}

export function CheckoutForm({ cart, totals, onSubmit, onSuccess, onClose }: Props) {
  const [fields, setFields] = useState<CheckoutFields>({ name: '', dining: '', note: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<{ message: string; uncertain: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);
  const attempt = useRef<{ fingerprint: string; request: OrderRequest } | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const diningInput = useRef<HTMLSelectElement>(null);
  const noteInput = useRef<HTMLTextAreaElement>(null);

  const recovering = Boolean(failure?.uncertain && attempt.current);
  const displayed = (submitting || recovering) ? attempt.current?.request : undefined;
  const shownCart = displayed?.cart ?? cart;
  const shownTotals = displayed?.totals ?? totals;
  const items = shownCart.flatMap(line => {
    const product = productsById.get(line.id);
    return product ? [{ ...line, name: product.name, price: product.price }] : [];
  });
  const soldOut = shownCart.some(line => productsById.get(line.id)?.soldOut);

  function updateField<K extends keyof CheckoutFields>(key: K, value: CheckoutFields[K]) {
    setFields(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || (!cart.length && !recovering) || soldOut) return;
    const validation = validateCheckout(fields);
    setErrors(validation.errors);
    if (!validation.value) {
      const first = validation.errors.name ? nameInput : validation.errors.dining ? diningInput : noteInput;
      first.current?.focus();
      return;
    }

    const input = { ...validation.value, cart, totals };
    const fingerprint = JSON.stringify(input);
    let request = attempt.current?.request;
    if (!request || (!recovering && attempt.current?.fingerprint !== fingerprint)) {
      request = { ...input, requestId: createRequestId() };
      attempt.current = { fingerprint, request };
    }

    pending.current = true;
    setSubmitting(true);
    setFailure(null);
    try {
      onSuccess(await onSubmit(request));
    } catch (error) {
      const message = error instanceof Error ? error.message : '送出訂單失敗，請重試。';
      setFailure({ message, uncertain: error instanceof ApiError && error.kind === 'network' });
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Modal titleId="checkout-heading" className="checkout-dialog" dismissible={!submitting} onClose={onClose}>
      <div className="checkout-content">
        <h2 id="checkout-heading">確認訂單</h2>
        <OrderSummary items={items} totals={shownTotals} />
        {!shownCart.length && <p role="status">購物車目前是空的。</p>}
        {soldOut && <p role="status">購物車包含售完商品，請返回購物車移除。</p>}

        <form className="checkout-form" noValidate onSubmit={submit} aria-busy={submitting}>
          <fieldset disabled={submitting || recovering}>
            <div className="form-field">
              <label htmlFor="pickup-name">取餐姓名（必填）</label>
              <input ref={nameInput} id="pickup-name" autoComplete="nickname" required maxLength={NAME_LIMIT}
                value={fields.name} onChange={event => updateField('name', event.target.value)}
                aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'pickup-name-error' : undefined} />
              {errors.name && <p id="pickup-name-error" className="field-error">{errors.name}</p>}
            </div>
            <div className="form-field">
              <label htmlFor="dining">用餐方式（必填）</label>
              <select ref={diningInput} id="dining" required value={fields.dining}
                onChange={event => updateField('dining', event.target.value as CheckoutFields['dining'])}
                aria-invalid={Boolean(errors.dining)} aria-describedby={errors.dining ? 'dining-error' : undefined}>
                <option value="">請選擇</option>
                <option value="dine-in">內用</option>
                <option value="takeaway">外帶</option>
              </select>
              {errors.dining && <p id="dining-error" className="field-error">{errors.dining}</p>}
            </div>
            <div className="form-field">
              <label htmlFor="order-note">備註（選填，最多 {NOTE_LIMIT} 字）</label>
              <textarea ref={noteInput} id="order-note" rows={2} maxLength={NOTE_LIMIT}
                value={fields.note} onChange={event => updateField('note', event.target.value)}
                aria-invalid={Boolean(errors.note)} aria-describedby={errors.note ? 'note-error' : undefined} />
              {errors.note && <p id="note-error" className="field-error">{errors.note}</p>}
            </div>
          </fieldset>

          <p>付款方式　{DEMO_PAYMENT}</p>
          {failure && <p role="alert" className="field-error">{failure.message}{recovering && ' 可重試以確認原訂單結果。'}</p>}
          <div className="checkout-actions">
            <button type="button" className="secondary-btn" disabled={submitting}
              onClick={event => event.currentTarget.closest('dialog')?.close()}>返回購物車</button>
            <button type="submit" className="glow-btn" disabled={submitting || soldOut || (!cart.length && !recovering)}>
              {submitting ? '送出中…' : failure ? '重試送出' : '送出示範訂單'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
