import { Link } from 'react-router';

export function AboutPage() {
  return (
    <div className="page-container slide-in">
      <h1 tabIndex={-1}>關於溫馨小食堂</h1>
      <section className="about-block" aria-labelledby="about-title">
        <h2 id="about-title">點餐網站作品</h2>
        <p>這是以 React 與 TypeScript 製作的點餐示範。你可以依分類瀏覽餐點、調整購物車，或玩小遊戲取得折扣。</p>
        <p>購物車、遊戲與示範訂單儲存在目前使用的瀏覽器。訂單由 Mock API 建立，付款方式為現場付款（模擬）。</p>
        <Link to="/" className="back-link">瀏覽今日菜單</Link>
      </section>
    </div>
  );
}
