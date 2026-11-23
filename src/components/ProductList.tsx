import type { CategoryFilter as Filter, Product } from '../domain/order';
import { formatPrice } from '../domain/orderRules';
import { ProductPhoto } from './ProductPhoto';

const categories: { value: Filter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'breakfast', label: '早餐' },
  { value: 'lunch', label: '午餐' },
  { value: 'drink', label: '飲料' },
  { value: 'dessert', label: '甜點' },
];

interface FilterProps {
  selected: Filter;
  onChange: (category: Filter) => void;
}

export function CategoryFilter({ selected, onChange }: FilterProps) {
  return (
    <fieldset className="tabs">
      <legend className="visually-hidden">餐點分類</legend>
      {categories.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          className="tab-btn"
          aria-pressed={selected === value}
          onClick={() => onChange(value)}
        >
          {label}
        </button>
      ))}
    </fieldset>
  );
}

interface ProductActions {
  onAdd: (product: Product) => void;
  onPreview: (product: Product) => void;
  disabled: boolean;
}

export function ProductCard({ product, priority, onAdd, onPreview, disabled }: ProductActions & { product: Product; priority: boolean }) {
  return (
    <article className="menu-item" data-product-id={product.id}>
      <button type="button" className="image-trigger" aria-label={`放大${product.name}照片`} onClick={() => onPreview(product)}>
        <ProductPhoto product={product} mode="thumbnail" priority={priority} />
      </button>
      <h2>{product.name}</h2>
      <p className="desc">{product.description}</p>
      <p className="price">{formatPrice(product.price)}</p>
      <button
        type="button"
        className="add-btn"
        aria-label={product.soldOut ? `已售完：${product.name}` : `加入購物車：${product.name}`}
        disabled={disabled || product.soldOut}
        onClick={() => onAdd(product)}
      >
        {product.soldOut ? '已售完' : '加入購物車'}
      </button>
    </article>
  );
}

export function ProductList({ products, ...actions }: ProductActions & { products: Product[] }) {
  return <div className="menu-grid">{products.map((product, index) => (
    <ProductCard key={product.id} product={product} priority={index === 0} {...actions} />
  ))}</div>;
}
