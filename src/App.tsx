import { useEffect, useRef, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router';
import { DiscountGame } from './components/DiscountGame';
import { Header } from './components/Header';
import { AboutPage } from './pages/AboutPage';
import { MenuPage } from './pages/MenuPage';
import { OrderDetailPage, OrdersPage } from './pages/OrdersPage';
import type { CategoryFilter } from './domain/order';

const titles: Record<string, string> = { '/': '菜單', '/game': '折扣小遊戲', '/about': '關於', '/orders': '訂單紀錄' };

function NotFound() {
  return (
    <div className="page-container">
      <h1 tabIndex={-1}>找不到頁面</h1>
      <Link to="/" className="back-link">回到菜單</Link>
    </div>
  );
}

export default function App() {
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  const [menuCategory, setMenuCategory] = useState<CategoryFilter>('all');

  useEffect(() => {
    document.title = `溫馨小食堂｜${titles[pathname] ?? (pathname.startsWith('/orders/') ? '訂單詳情' : '找不到頁面')}`;
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      window.scrollTo(0, 0);
      main.current?.querySelector('h1')?.focus({ preventScroll: true });
    }
  }, [pathname]);

  return (
    <>
      <button type="button" className="skip-link" onClick={() => main.current?.focus()}>跳至主要內容</button>
      <Header />
      <main id="main-content" ref={main} tabIndex={-1}>
        <Routes>
          <Route path="/" element={<MenuPage category={menuCategory} onCategoryChange={setMenuCategory} />} />
          <Route path="/game" element={<DiscountGame />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <div className="light-orb" aria-hidden="true" />
    </>
  );
}
