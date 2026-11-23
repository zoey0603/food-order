export type Category = 'breakfast' | 'lunch' | 'drink' | 'dessert';
export type CategoryFilter = Category | 'all';

export interface Product {
  id: string;
  name: string;
  price: number;
  category: readonly Category[];
  image: string;
  thumbnail?: string;
  soldOut?: boolean;
  description: string;
}

export interface CartItem {
  id: Product['id'];
  qty: number;
}

export interface GameRecord {
  date: string;
  plays: number;
  bestDiscount: number;
}

export interface OrderState {
  cart: CartItem[];
  game: GameRecord;
}

export type CartAction =
  | { type: 'clear' }
  | { type: 'add'; id: string }
  | { type: 'adjust'; id: string; delta: 1 | -1 }
  | { type: 'set'; id: string; qty: number; expectedQty: number }
  | { type: 'remove'; id: string };
