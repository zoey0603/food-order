const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const evidence = process.env.FOOD_ORDER_EVIDENCE_DIR;
const engine = process.env.FOOD_ORDER_BROWSER || 'chromium';
const port = Number(process.env.FOOD_ORDER_TEST_PORT || '4184');
const pendingKey = 'food-order-pending-game-v1';
const errors = [];
const checks = [];
const sizes = {};
const pass = name => { checks.push(name); console.log('PASS', name); };
const photo = (page, id) => page.locator('[data-product-id="' + id + '"] .image-trigger');
const nav = (page, name) => page.getByRole('link', { name, exact: true });
const start = page => page.locator('#start-game');
const target = page => page.locator('#target');
const plays = page => page.locator('#remaining-plays');

async function screenshot(page, name) {
  if (evidence) await page.screenshot({ path: path.join(evidence, name + '.png'), animations: 'disabled' });
}

async function text(locator, expected) {
  const escaped = expected.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
  await locator.filter({ hasText: new RegExp('^' + escaped + '$') }).waitFor();
  assert.equal((await locator.textContent()).trim(), expected);
}

async function observe(context) {
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.location().url + ' ' + message.text());
  });
  page.on('response', response => {
    if (response.status() >= 400) errors.push(response.status() + ' ' + response.url());
  });
  return page;
}

async function openPreview(page, id) {
  const opener = photo(page, id);
  await opener.press('Enter');
  const dialog = page.getByRole('dialog');
  try {
    await dialog.locator('.product-photo[data-status="ready"]').waitFor();
  } catch (error) {
    await screenshot(page, 'preview-failure-' + id);
    throw new Error('Preview was not ready for ' + id + ' at ' + page.viewportSize()?.width + 'px', { cause: error });
  }
  return { dialog, opener };
}

async function gallery(browser, url, playwright) {
  const viewports = [[1280, 860], [820, 900], [390, 844], [844, 390]];
  const products = ['cheese-toast', 'ham-egg-toast', 'black-tea', 'curry-rice', 'caramel-pudding'];
  for (const [width, height] of viewports) {
    const mobile = engine === 'webkit' && width < 900 ? playwright.devices['iPhone 13'] : {};
    const context = await browser.newContext({ ...mobile, viewport: { width, height }, reducedMotion: 'reduce', hasTouch: width < 900 });
    const page = await observe(context);
    await page.goto(url);
    const frames = page.locator('.product-photo--thumbnail');
    await frames.first().waitFor();
    assert.equal(await frames.count(), 12);
    const boxes = await frames.evaluateAll(items => items.map(item => {
      const rect = item.getBoundingClientRect();
      return [rect.width, rect.height];
    }));
    for (const [w, h] of boxes) {
      assert.ok(Math.abs(w / h - 4 / 3) < 0.01);
      assert.ok(Math.abs(w - boxes[0][0]) < 0.5 && Math.abs(h - boxes[0][1]) < 0.5);
    }

    await frames.first().locator('img').evaluate(img => img.decode());
    if (width === 1280 || width === 390) await screenshot(page, width === 1280 ? 'desktop' : 'mobile');
    const measured = {};
    for (const id of products) {
      const { dialog, opener } = await openPreview(page, id);
      assert.equal(await dialog.locator('img').evaluate(img => getComputedStyle(img).objectFit), 'contain');
      const rect = await dialog.boundingBox();
      assert.ok(rect.width <= width && rect.height <= height);
      measured[id] = [Math.round(rect.width), Math.round(rect.height)];
      if (width === 1280 && id === 'ham-egg-toast') await screenshot(page, 'preview');
      if (width === 844 && id === 'black-tea') await screenshot(page, 'landscape');
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(await opener.evaluate(el => el === document.activeElement), true);
    }
    assert.equal(new Set(Object.values(measured).map(dimensions => dimensions.join('x'))).size, 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
    if (width === 844) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const { dialog } = await openPreview(page, 'ham-egg-toast');
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
      }
    }
    if (width === 390) {
      await photo(page, 'cheese-toast').tap();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: '關閉餐點照片' }).tap();
      await dialog.waitFor({ state: 'hidden' });
    }
    sizes[width] = { thumbnail: boxes[0].map(Math.round), dialog: measured };
    await context.close();
  }
  pass('12 uniform thumbnails and 5 equal-size previews at 4 viewport sizes');
}

async function replacementPhotos(browser, url) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: 'reduce' });
  const page = await observe(context);
  await page.goto(url);
  for (const [id, width, height, file] of [
    ['hot-soy-milk', 900, 600, 'soy-milk'],
    ['chocolate-brownie', 1600, 1066, 'brownie'],
  ]) {
    const opener = photo(page, id);
    await opener.scrollIntoViewIfNeeded();
    await opener.locator('[data-status="ready"]').waitFor();
    assert.match(await opener.locator('img').evaluate(img => img.currentSrc), /\.webp$/);
    const { dialog } = await openPreview(page, id);
    assert.deepEqual(await dialog.locator('img').evaluate(img => [img.naturalWidth, img.naturalHeight]), [width, height]);
    await screenshot(page, file);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
  }
  await context.close();
  pass('replacement soy milk and brownie previews load full attachment resolution');
}

async function imagesFailGracefully(browser, url) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: 'reduce' });
  const page = await observe(context);
  await context.addCookies([{ name: 'food-order-invalid-photos', value: '1', url }]);
  await page.goto(url);
  const first = photo(page, 'cheese-toast');
  await first.locator('[data-status="unavailable"]').waitFor();
  const before = await first.boundingBox();
  const healthy = await photo(page, 'ham-egg-toast').boundingBox();
  assert.ok(Math.abs(before.width - healthy.width) < 0.5 && Math.abs(before.height - healthy.height) < 0.5);
  await screenshot(page, 'fallback');
  await first.click();
  const unavailable = page.getByRole('dialog');
  await text(unavailable.getByRole('status'), '照片暫時無法載入');
  await page.keyboard.press('Escape');
  await unavailable.waitFor({ state: 'hidden' });
  assert.deepEqual(await first.boundingBox(), before);

  const { dialog } = await openPreview(page, 'caramel-pudding');
  assert.match(await dialog.locator('img').evaluate(el => el.currentSrc), /pudding-.*\.webp/);
  await context.close();
  pass('image decode failure reserves its frame and falls back to available WebP');
}

async function accessibleControls(browser, url) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: 'reduce' });
  const page = await observe(context);
  await page.goto(url);
  const skip = page.getByRole('button', { name: '跳至主要內容' });
  await skip.focus();
  assert.equal(await skip.evaluate(el => el === document.activeElement && el.getBoundingClientRect().top >= 0), true);
  await skip.press('Enter');
  const main = page.getByRole('main');
  assert.equal(await main.evaluate(el => el === document.activeElement), true);
  assert.match(await main.ariaSnapshot(), /heading "今日菜單"/);

  const { dialog, opener } = await openPreview(page, 'hot-soy-milk');
  assert.match(await dialog.ariaSnapshot(), /dialog "熱豆漿"/);
  assert.match(await dialog.ariaSnapshot(), /button "關閉餐點照片"/);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await opener.evaluate(el => el === document.activeElement), true);

  await page.getByRole('button', { name: '加入購物車：起司厚片' }).click();
  const field = page.getByRole('textbox', { name: '起司厚片數量' });
  await field.fill('-2');
  await field.press('Enter');
  assert.equal(await field.getAttribute('aria-invalid'), 'true');
  assert.equal(await field.evaluate(el => el === document.activeElement), true);
  const error = await field.evaluate(el => document.getElementById(el.getAttribute('aria-describedby'))?.textContent);
  assert.match(error, /數量請輸入 1 到 99 的整數/);
  await screenshot(page, 'a11y');
  await context.close();
  pass('accessibility names, skip link, dialog focus and associated quantity error');
}

async function retryAfterRouteChange(browser, url) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: 'reduce', timezoneId: 'Asia/Taipei' });
  const page = await observe(context);
  await page.goto(url);
  const add = page.locator('[data-product-id="cheese-toast"] .add-btn');
  for (let count = 0; count < 5; count++) await add.click();
  await text(page.locator('#total-price'), 'NT$270');
  await page.getByRole('button', { name: '甜點' }).click();
  await nav(page, '折扣遊戲').click();
  await start(page).click();
  await target(page).waitFor();
  for (let count = 0; count < 22; count++) await target(page).press(count % 2 ? 'Space' : 'Enter');
  await text(page.locator('#score'), '22');
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, ...args) {
      if (value.game.bestDiscount > 0) {
        IDBObjectStore.prototype.put = put;
        throw new DOMException('Injected result write failure', 'QuotaExceededError');
      }
      return put.call(this, value, ...args);
    };
  });
  const retry = page.getByRole('button', { name: '重試儲存結果' });
  await retry.waitFor({ timeout: 14000 });
  await nav(page, '關於').click();
  await nav(page, '折扣遊戲').click();
  await retry.waitFor();
  await text(page.locator('#score'), '22');
  await text(plays(page), '2');
  await text(page.locator('#current-discount'), 'NT$0');
  await nav(page, '菜單').click();
  assert.equal(await page.getByRole('button', { name: '甜點' }).getAttribute('aria-pressed'), 'true');
  await page.locator('.menu-item').first().waitFor();
  assert.equal(await page.locator('.menu-item').count(), 3);
  await nav(page, '折扣遊戲').click();
  await retry.waitFor();
  const pending = await page.evaluate(key => sessionStorage.getItem(key), pendingKey);
  assert.ok(pending);
  assert.equal(JSON.parse(pending).score, 22);
  await page.reload();
  await retry.waitFor();
  await text(page.locator('#score'), '22');
  await text(plays(page), '2');
  await page.getByRole('status').filter({ hasText: '本局得到 22 分' }).waitFor();
  await screenshot(page, 'retry');
  await retry.click();
  await text(page.locator('#current-discount'), 'NT$100');
  await text(plays(page), '2');
  await page.waitForFunction(key => sessionStorage.getItem(key) === null, pendingKey);
  await nav(page, '菜單').click();
  await text(page.locator('#total-price'), 'NT$170');
  await page.getByRole('button', { name: '結帳', exact: true }).click();
  await page.getByLabel('取餐姓名（必填）').fill('回歸測試');
  await page.getByLabel('用餐方式（必填）').selectOption('takeaway');
  await page.getByRole('button', { name: '送出示範訂單' }).click();
  const receipt = page.getByRole('dialog', { name: '示範結帳完成' });
  await receipt.getByText('NT$170', { exact: true }).waitFor();
  await screenshot(page, 'checkout');
  await page.keyboard.press('Escape');
  await receipt.waitFor({ state: 'hidden' });
  await text(page.locator('#total-price'), 'NT$0');
  await nav(page, '訂單紀錄').click();
  await page.getByText('滿額折扣 NT$30 · 遊戲折扣 NT$100', { exact: true }).waitFor();
  await nav(page, '折扣遊戲').click();
  await text(plays(page), '2');
  await text(page.locator('#current-discount'), 'NT$0');
  await page.reload();
  await text(plays(page), '2');
  await text(page.locator('#current-discount'), 'NT$0');
  // Simulate an interruption after the DB commit but before journal cleanup.
  await page.evaluate(({ key, pending }) => sessionStorage.setItem(key, pending), { key: pendingKey, pending });
  await page.reload();
  await retry.click();
  await page.waitForFunction(key => sessionStorage.getItem(key) === null, pendingKey);
  await text(page.locator('#current-discount'), 'NT$0');
  await text(plays(page), '2');
  await context.close();
  pass('22 points recover after navigation and reload; paid discount cannot be reapplied by replay');
}

async function delayedTimer(browser, url) {
  const context = await browser.newContext({ reducedMotion: 'reduce', timezoneId: 'Asia/Taipei' });
  const page = await observe(context);
  await page.clock.install();
  await page.goto(url + '#/game');
  await page.evaluate(() => {
    const interval = window.setInterval;
    window.setInterval = (callback, delay, ...args) => delay === 100
      ? window.setTimeout(() => {}, 60000)
      : interval(callback, delay, ...args);
  });
  await start(page).click();
  await target(page).waitFor();
  await target(page).press('Enter');
  await target(page).press('Space');
  await page.clock.fastForward(11000);
  assert.equal(await target(page).isVisible(), true);
  await nav(page, '菜單').click();
  await nav(page, '折扣遊戲').click();
  await text(page.locator('#current-discount'), 'NT$10');
  await text(plays(page), '2');

  await start(page).click();
  await target(page).waitFor();
  await target(page).press('Enter');
  await nav(page, '菜單').click();
  await nav(page, '折扣遊戲').click();
  await text(page.locator('#current-discount'), 'NT$10');
  await text(plays(page), '1');
  assert.equal(await target(page).isVisible(), false);
  await context.close();
  pass('route exit credits a finished throttled timer and still discards unfinished rounds');
}

(async () => {
  const playwright = require(process.env.FOOD_ORDER_PLAYWRIGHT || 'playwright');
  const { preview } = await import('vite');
  if (evidence) await fs.mkdir(evidence, { recursive: true });
  const server = await preview({
    preview: { host: '127.0.0.1', port, strictPort: true },
    plugins: [{
      name: 'test-image-decode-failure',
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.headers.cookie?.includes('food-order-invalid-photos=1')
            && /\/assets\/(?:toast|pudding)-[^/]+\.jpg$/.test(req.url || '')) {
            // Deliver the corrupt bytes from the server so the worker also sees the failure.
            res.writeHead(200, { 'Content-Type': 'image/jpeg' }).end('invalid image payload');
          } else next();
        });
      },
    }],
  });
  const url = 'http://127.0.0.1:' + port + '/';
  let browser;
  try {
    assert.ok(['chromium', 'firefox', 'webkit'].includes(engine));
    browser = await playwright[engine].launch({
      executablePath: engine === 'chromium' ? process.env.FOOD_ORDER_CHROME_PATH || undefined : undefined,
      headless: true,
    });
    console.log(engine, browser.version());
    for (const scenario of [gallery, replacementPhotos, imagesFailGracefully, accessibleControls, retryAfterRouteChange, delayedTimer]) {
      await scenario(browser, url, playwright);
      assert.deepEqual(errors, []);
    }
    pass('no page errors, console errors or failed HTTP responses');
    console.log(JSON.stringify(sizes));
    if (evidence) await fs.writeFile(path.join(evidence, 'results.json'), JSON.stringify({
      engine, browser: browser.version(), checks, sizes,
    }, null, 2));
  } finally {
    await browser?.close();
    await server.close();
  }
})().catch(error => {
  console.error(error);
  if (errors.length) console.error(errors);
  process.exitCode = 1;
});
