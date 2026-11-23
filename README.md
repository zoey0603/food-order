# 溫馨小食堂

用 React、TypeScript、Vite 與 React Router 製作的點餐作品。提供商品搜尋、分類與價格排序、購物車、結帳表單、訂單詳情與 10 秒折扣遊戲。

## 在本機執行

需要 Node.js 22.12 以上。

```sh
npm install
npm run dev
```

開啟終端機顯示的本機網址。執行型別檢查或預覽正式建置：

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

## 程式結構

| 位置 | 負責內容 |
| --- | --- |
| `src/App.tsx` | 路由、頁首、頁面標題與換頁焦點 |
| `src/components/` | 商品卡、分類、數量、金額摘要、對話框與折扣遊戲 |
| `src/pages/` | 菜單、購物車、訂單紀錄與詳情 |
| `src/data/products.ts` | 商品 ID、價格、分類、照片與描述 |
| `src/domain/` | 型別、資料驗證、數量及折扣規則 |
| `src/state/` | 購物車 Context、舊資料復原與跨分頁儲存 |
| `src/api/` | Fetch 請求、非 2xx 與網路錯誤、非同步讀取狀態 |
| `src/mocks/` | MSW 路由與示範資料處理 |

由元件發出購物車或遊戲操作，儲存層序列化命令，在交易完成後發佈已提交的狀態。Provider 透過 `useSyncExternalStore` 訂閱狀態，再由 Context 提供給各頁。舊分頁的手動數量修改會比對編輯時的數量，避免覆寫其他分頁的更新。

購物車和示範訂單保留在目前瀏覽器與同一來源（網址的協定、主機和連接埠）。延續舊網站資料時，請使用舊版相同的來源。若瀏覽器限制持久化，畫面會提示可用的操作。

## MSW 模擬 API

本作品的 API 由 Mock Service Worker 在瀏覽器攔截，示範訂單儲存在本機 IndexedDB。付款方式為「現場付款（模擬）」，整個流程為前端作品展示。

| API | 功能 |
| --- | --- |
| `GET /api/products` | 讀取品名、價格、分類、圖片與售完狀態 |
| `POST /api/orders` | 驗證資料與即時購物車、建立訂單並保留金額快照 |
| `GET /api/orders` | 讀取此瀏覽器的訂單紀錄 |
| `GET /api/orders/:id` | 依訂單編號讀取詳情 |

頁面以 `fetch` 和 `async/await` 讀取商品與訂單，顯示載入、成功、錯誤和空資料狀態。結帳表單先驗證必填欄位與字數，再送出購物車與金額摘要。Mock handler 重新驗證並比對交易當下的商品、數量和折扣。IndexedDB 在同一筆交易保存訂單、清空購物車並使用本次遊戲折扣。相同的送出識別與資料重送時，API 會回傳原訂單。

### 重現錯誤

在頁面網址的 `#` 前加上對應參數，例如 `/?mock=http#/`。每個載入只模擬一次指定情境。

| 參數 | 情境 |
| --- | --- |
| `mock=products` / `mock=orders` | 商品或訂單清單第一次讀取回傳 HTTP 503 |
| `mock=http` | 建單前回傳 HTTP 503，購物車保留，可重試 |
| `mock=network` | 建單前模擬連線失敗，購物車保留，可重試 |
| `mock=response-lost` | 訂單交易已完成，回應途中遺失。重試取回同一筆訂單 |

## 折扣與部署

小計滿 NT$300 折 NT$30。遊戲每天可玩 3 次，每分折 NT$5，上限 NT$100。保留可用的最高遊戲折扣，示範結帳會使用該折扣並保留當天次數。

`npm run build` 產生 `dist/`。請將整個資料夾部署於 HTTPS 靜態空間，並保留 `mockServiceWorker.js`。本機可使用 localhost。MSW 在 Demo 建置中也會啟用，子路徑的 API 與 Worker 會跟隨頁面基底，例如 `/food-order/api/orders`。子路徑首頁請以帶尾端斜線的網址開啟，或設定主機自動轉址。HashRouter 使訂單詳情重整時仍使用同一個靜態入口。

新版的示範訂單功能使用瀏覽器儲存與 MSW 模擬處理，訂單清單也由這個本機資料來源提供。升級 MSW 時可用 `npx msw init public --no-save` 更新 Worker 腳本。

## 驗收

有 Playwright 環境時，先執行 `npm run build`，再執行 `npm run test:checkout`。此測試將正式建置掛在本機靜態子路徑，跑過查找商品、必填驗證、HTTP 與網路錯誤、跨分頁重送、結帳及重整訂單。沿用下方的瀏覽器環境變數。

[瀏覽器驗收報告與截圖](output/pdf/food-order-react-verification.pdf)記錄桌機、平板、手機尺寸、結帳、折扣與舊資料復原的實測結果。

`npm test` 會重跑數量編輯衝突、資料驗證、折扣上限、跨日與結帳摘要測試。[交易與操作驗收報告](output/pdf/food-order-quality-verification.pdf)包含資料庫寫入失敗、跨分頁同步、鍵盤編輯及手機遊戲截圖。

菜單照片共用 4:3 圖框。放大預覽使用受視窗約束的固定框，保留原照比例；載入失敗時會使用可用的替代圖或顯示提示。在站內切頁後回到菜單，仍會選中原分類。遊戲結束時先將待儲存分數記在目前分頁的 `sessionStorage`，重新整理後可以回來重試。IndexedDB 交易會同時記下該局已完成，避免同一局在結帳後再發放折扣。

[照片尺寸與流程驗收](output/pdf/food-order-photo-and-flow-verification.pdf)記錄改版前後的圖框量測、不同螢幕尺寸、圖片降級及遊戲折扣流程。

如已有 Playwright，執行 `npm run build` 後可用 `npm run test:browser` 重跑上述瀏覽器測試。若工具安裝在其他目錄，將 `FOOD_ORDER_PLAYWRIGHT` 指向該套件的絕對路徑，並可用 `FOOD_ORDER_CHROME_PATH` 指定本機 Chrome。設定 `FOOD_ORDER_EVIDENCE_DIR` 可另存測試截圖與量測 JSON。

使用 `FOOD_ORDER_BROWSER=firefox` 或 `FOOD_ORDER_BROWSER=webkit` 可切換測試引擎，需備妥相應的 Playwright 瀏覽器。WebKit 的窄螢幕案例使用 iPhone 13 裝置設定。測試報告會分開記錄模擬與實機驗收。

[重整復原與跨瀏覽器驗收](output/pdf/food-order-compatibility-verification.pdf)包含新照片、分數重整與防重複發放，以及鍵盤和無障礙語意測試的證據。
