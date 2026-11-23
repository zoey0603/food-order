const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const base = '/portfolio/food-order/';
const dist = path.resolve('dist');
const evidence = process.env.FOOD_ORDER_EVIDENCE_DIR;
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg',
};
const pass = message => console.log('PASS', message);
const checkout = page => page.getByRole('button', { name: '結帳', exact: true });
const add = page => page.getByRole('button', { name: '加入購物車：起司厚片' });
const amount = page => page.locator('#total-price');

async function shot(page, name) {
  if (evidence) await page.screenshot({ path: path.join(evidence, name + '.png'), animations: 'disabled' });
}

async function waitAmount(page, expected) {
  await page.waitForFunction(value => document.querySelector('#total-price')?.textContent === value, expected);
  assert.equal((await amount(page).textContent()).trim(), expected);
}

async function staticServer() {
  const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (!pathname.startsWith(base)) {
      res.writeHead(404).end();
      return;
    }
    const file = path.resolve(dist, decodeURIComponent(pathname.slice(base.length)) || 'index.html');
    if (!file.startsWith(dist + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': contentTypes[path.extname(file)] || 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, url: 'http://127.0.0.1:' + server.address().port + base };
}

const pageErrors = [];

async function openCatalog(context, url, mock = '') {
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(url + (mock ? '?mock=' + mock : ''));
  await add(page).waitFor();
  assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.ready).scope.endsWith('/portfolio/food-order/')), true);
  return page;
}

async function populateCheckout(page) {
  await checkout(page).click();
  const form = page.getByRole('dialog', { name: '確認訂單' });
  await form.getByLabel('取餐姓名（必填）').fill('林小食');
  await form.getByLabel('用餐方式（必填）').selectOption('takeaway');
  await form.getByLabel(/備註/).fill('請分袋');
  return form;
}

async function getOrders(page, url) {
  return page.evaluate(endpoint => fetch(endpoint).then(response => response.json()), url + 'api/orders');
}

async function normalFlow(browser, url) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await openCatalog(context, url);
  assert.equal(await checkout(page).isDisabled(), true);
  await page.getByRole('link', { name: '訂單紀錄' }).click();
  await page.getByText('目前沒有示範訂單。', { exact: true }).waitFor();
  await page.getByRole('link', { name: '菜單', exact: true }).click();

  const search = page.getByRole('searchbox', { name: '搜尋商品' });
  await search.fill('不存在');
  await page.getByText('找不到符合條件的商品。', { exact: true }).waitFor();
  await page.getByRole('button', { name: '清除搜尋與篩選' }).click();
  await page.getByRole('button', { name: '飲料' }).click();
  await page.getByLabel('商品排序').selectOption('price-asc');
  assert.equal(await page.locator('.menu-item').first().getAttribute('data-product-id'), 'black-tea');
  await page.getByLabel('商品排序').selectOption('price-desc');
  const prices = await page.locator('.menu-item .price').allTextContents();
  assert.deepEqual(prices.map(value => Number(value.replace('NT$', ''))), [45, 45, 40, 35]);
  assert.equal(await page.getByRole('button', { name: '已售完：茉莉綠茶' }).isDisabled(), true);
  await page.getByRole('button', { name: '全部' }).click();
  await add(page).click();
  await waitAmount(page, 'NT$60');
  await page.getByRole('button', { name: '增加起司厚片數量' }).click();
  await waitAmount(page, 'NT$120');
  await page.getByRole('button', { name: '減少起司厚片數量' }).click();
  await waitAmount(page, 'NT$60');
  await page.getByRole('button', { name: '移除起司厚片' }).click();
  await waitAmount(page, 'NT$0');
  await add(page).click();
  await page.getByRole('button', { name: '清空購物車' }).click();
  await page.getByText('已清空購物車。', { exact: true }).waitFor();
  assert.equal(await checkout(page).isDisabled(), true);
  await add(page).click();
  await waitAmount(page, 'NT$60');
  await checkout(page).click();
  const form = page.getByRole('dialog', { name: '確認訂單' });
  await form.getByRole('button', { name: '送出示範訂單' }).click();
  await form.getByText('請輸入取餐姓名。', { exact: true }).waitFor();
  assert.equal(await form.getByLabel('取餐姓名（必填）').evaluate(el => document.activeElement === el), true);
  assert.deepEqual(await getOrders(page, url), []);
  await form.getByLabel('取餐姓名（必填）').fill('林小食');
  await form.getByLabel('用餐方式（必填）').selectOption('takeaway');
  await form.getByLabel(/備註/).fill('請分袋');
  assert.equal(await form.getByText('NT$60', { exact: true }).count(), 3);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), true);
  await shot(page, 'checkout-mobile');

  await form.locator('form').evaluate(element => {
    element.requestSubmit();
    element.requestSubmit();
  });
  await form.getByRole('button', { name: '送出中…' }).waitFor();
  const receipt = page.getByRole('dialog', { name: '示範結帳完成' });
  await receipt.getByText('NT$60', { exact: true }).last().waitFor();
  await receipt.getByRole('link', { name: '查看訂單詳情' }).click();
  await page.getByText('林小食', { exact: true }).waitFor();
  await page.getByText('請分袋', { exact: true }).waitFor();
  await page.getByText('起司厚片 × 1', { exact: true }).waitFor();
  await page.getByText('已接單（模擬）', { exact: true }).waitFor();
  await shot(page, 'order-detail-mobile');
  const detailUrl = page.url();
  assert.match(detailUrl, /#\/orders\/FO-[A-F0-9]{32}$/);
  await page.reload();
  await page.getByText('林小食', { exact: true }).waitFor();
  await page.getByRole('link', { name: '返回訂單紀錄' }).click();
  await page.locator('.history-card').waitFor();
  assert.equal(await page.locator('.history-card').count(), 1);
  const orders = await getOrders(page, url);
  assert.equal(orders.length, 1);
  assert.equal(orders[0].totals.total, 60);
  assert.equal(orders[0].dining, 'takeaway');
  assert.equal(Number.isNaN(Date.parse(orders[0].createdAt)), false);
  await page.getByRole('link', { name: '菜單', exact: true }).click();
  await waitAmount(page, 'NT$0');
  await context.close();
  pass('mobile subpath: catalog, clear, empty states, required fields, loading, double submit, persisted order and exact total');
}

async function errorsAndRetry(browser, url) {
  for (const [mode, message] of [
    ['http', /HTTP 503/], ['network', /網路連線失敗/], ['response-lost', /確認原訂單結果/],
    ['storage', /目前無法儲存示範訂單/],
  ]) {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await openCatalog(context, url, mode);
    await add(page).click();
    await waitAmount(page, 'NT$60');
    const form = await populateCheckout(page);
    if (mode === 'storage') {
      await page.evaluate(() => {
        const original = IDBObjectStore.prototype.add;
        IDBObjectStore.prototype.add = function (value, key) {
          if (typeof key === 'string' && key.startsWith('demo-order:')) {
            IDBObjectStore.prototype.add = original;
            throw new DOMException('Simulated order storage failure', 'QuotaExceededError');
          }
          return original.call(this, value, key);
        };
      });
    }
    await form.getByRole('button', { name: '送出示範訂單' }).click();
    await form.getByRole('alert').filter({ hasText: message }).waitFor();
    const alreadyCommitted = mode === 'response-lost';
    await waitAmount(page, alreadyCommitted ? 'NT$0' : 'NT$60');
    assert.equal((await getOrders(page, url)).length, alreadyCommitted ? 1 : 0);
    await form.getByRole('button', { name: '重試送出' }).click();
    await page.getByRole('dialog', { name: '示範結帳完成' }).waitFor();
    assert.equal((await getOrders(page, url)).length, 1);
    await waitAmount(page, 'NT$0');
    await context.close();
  }
  pass('HTTP, network and storage failures preserve the cart; lost response reuses the committed order');

  for (const [mode, initial, ready, button] of [
    ['products', '', '加入購物車：起司厚片', '重新載入菜單'],
    ['orders', '#/orders', '目前沒有示範訂單。', '重新載入'],
  ]) {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(url + '?mock=' + mode + initial);
    await page.getByRole('alert').waitFor();
    await page.getByRole('button', { name: button, exact: true }).click();
    if (mode === 'products') await page.getByRole('button', { name: ready }).waitFor();
    else await page.getByText(ready, { exact: true }).waitFor();
    await page.goto(url + '#/orders/FO-' + 'A'.repeat(32));
    await page.getByRole('alert').filter({ hasText: '找不到這筆示範訂單。' }).waitFor();
    await context.close();
  }
  pass('catalog and history GET errors retry successfully; unknown order returns 404');
}

async function concurrentRequests(browser, url) {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const first = await openCatalog(context, url);
  const second = await openCatalog(context, url);
  await add(first).click();
  await waitAmount(first, 'NT$60');
  const payload = {
    requestId: 'a'.repeat(32), name: '並行測試', dining: 'dine-in', note: '',
    cart: [{ id: 'cheese-toast', qty: 1 }],
    totals: { subtotal: 60, orderDiscount: 0, gameDiscount: 0, total: 60, itemCount: 1 },
  };
  const submit = (page, body) => page.evaluate(async ({ endpoint, body }) => {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, value: await response.json() };
  }, { endpoint: url + 'api/orders', body });
  assert.equal((await submit(first, { ...payload, name: ' '.repeat(3) })).status, 422);
  assert.equal((await submit(first, { ...payload, totals: { ...payload.totals, total: 1 } })).status, 409);
  await waitAmount(first, 'NT$60');
  const responses = await Promise.all([submit(first, payload), submit(second, payload)]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 201]);
  assert.equal(responses[0].value.id, responses[1].value.id);
  assert.equal((await submit(first, { ...payload, note: '不同內容' })).status, 409);
  assert.equal((await getOrders(first, url)).length, 1);
  await context.close();
  pass('cross-tab POST replay is idempotent; invalid fields, stale price and reused keys are rejected');
}

(async () => {
  const playwright = require(process.env.FOOD_ORDER_PLAYWRIGHT || 'playwright');
  if (evidence) await fs.mkdir(evidence, { recursive: true });
  const { server, url } = await staticServer();
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: process.env.FOOD_ORDER_CHROME_PATH || undefined });
    console.log('Chrome', browser.version(), url);
    for (const scenario of [normalFlow, errorsAndRetry, concurrentRequests]) await scenario(browser, url);
    assert.deepEqual(pageErrors, []);
    pass('no unhandled page exceptions');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
