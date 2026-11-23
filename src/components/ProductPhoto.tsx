import { useState } from 'react';
import type { Product } from '../domain/order';

interface Props {
  product: Product;
  mode: 'thumbnail' | 'preview';
  priority?: boolean;
}

export function ProductPhoto({ product, mode, priority = false }: Props) {
  const preview = mode === 'preview';
  const first = preview ? product.image : product.thumbnail ?? product.image;
  const alternate = preview ? product.thumbnail : product.image;
  const [source, setSource] = useState(first);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  function handleError() {
    if (source === first && alternate && alternate !== first) {
      setSource(alternate);
      setStatus('loading');
    } else {
      setStatus('unavailable');
    }
  }

  return (
    <span className={`product-photo product-photo--${mode}`} data-status={status}>
      {status !== 'unavailable' && (
        <img
          key={source}
          src={source}
          alt={preview ? product.name : ''}
          loading={preview || priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          onLoad={() => setStatus('ready')}
          onError={handleError}
        />
      )}
      {(status === 'unavailable' || (preview && status === 'loading')) && (
        <span className="photo-status" role={preview ? 'status' : undefined} aria-hidden={preview ? undefined : true}>
          {status === 'unavailable' ? '照片暫時無法載入' : '載入照片中…'}
        </span>
      )}
    </span>
  );
}
