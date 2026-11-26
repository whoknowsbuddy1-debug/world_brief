#!/usr/bin/env node
// Posts to Instagram @worldbrief_official through instagram.com in a headless browser (no API).
// Login comes ONLY from environment variables, never from files in this repo:
//   IG_SESSION   base64 of a Playwright storageState JSON (preferred: an already-logged-in session)
//   IG_USERNAME / IG_PASSWORD   fallback login
// Never print these values.
//
//   node scripts/ig-web.js check                                  logs in, prints the username, posts nothing
//   node scripts/ig-web.js carousel <caption-file> <img1.jpg> ...  2-10 local images, crop 4:5
//   node scripts/ig-web.js reel <caption-file> <video.mp4>         9:16 video, crop Original
//   node scripts/ig-web.js recent                                  latest post links on the profile
// Add DRY=1 to stop just before Share (for testing).
// On failure a screenshot is saved to media/_debug/<time>.png and the exit code is 1.
// If Instagram asks for a security code / "suspicious login", exit code is 3: the owner must approve the login.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const USER = 'worldbrief_official';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}) });
  let storageState;
  if (process.env.IG_SESSION) {
    try { storageState = JSON.parse(Buffer.from(process.env.IG_SESSION, 'base64').toString('utf8')); }
    catch { console.error('IG_SESSION is not valid base64 JSON; trying password login.'); }
  }
  const context = await browser.newContext({
    storageState,
    viewport: { width: 1280, height: 900 },
    locale: 'en-GB',
    timezoneId: 'Asia/Kolkata',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  return { browser, context, page };
}

async function debugShot(page, tag) {
  try {
    const dir = path.join(__dirname, '..', 'media', '_debug');
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${tag}.png`);
    await page.screenshot({ path: f });
    console.error('Screenshot:', f);
  } catch {}
}

async function dismiss(page) {
  for (const name of ['Not now', 'Not Now', 'OK', 'Allow all cookies', 'Decline optional cookies']) {
    const b = page.getByRole('button', { name, exact: true });
    if (await b.count().catch(() => 0)) await b.first().click({ timeout: 2000 }).catch(() => {});
  }
}

function challenged(page) {
  return /challenge|suspended|checkpoint|two_factor|auth_platform/.test(page.url());
}

async function login(page) {
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await dismiss(page);
  const loggedIn = async () => (await page.locator('svg[aria-label="New post"]').count()) > 0;
  if (await loggedIn()) return;
  if (!process.env.IG_USERNAME || !process.env.IG_PASSWORD) throw Object.assign(new Error('Not logged in and IG_USERNAME / IG_PASSWORD are not set.'), { code: 3 });
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  await dismiss(page);
  await page.locator('input[name="username"], input[aria-label*="username" i]').first().fill(process.env.IG_USERNAME);
  await page.locator('input[name="password"], input[type="password"]').first().fill(process.env.IG_PASSWORD);
  await page.keyboard.press('Enter');
  await sleep(9000);
  if (challenged(page)) throw Object.assign(new Error('Instagram asked for a security check. The owner must approve this login in the Instagram app, then the next run will work.'), { code: 3 });
  await dismiss(page);
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await dismiss(page);
  if (!(await loggedIn())) throw Object.assign(new Error('Login did not succeed (wrong password, or a check is needed).'), { code: 3 });
}

async function create(page, files, ratio, caption) {
  await page.locator('svg[aria-label="New post"]').first().click();
  await sleep(1500);
  const postItem = page.getByRole('link', { name: /^Post/ });
  if (await postItem.count()) await postItem.first().click();
  await page.locator('div[role="dialog"] input[type="file"]').first().waitFor({ state: 'attached', timeout: 20000 });
  await page.locator('div[role="dialog"] input[type="file"]').first().setInputFiles(files);
  await sleep(5000);
  const ok = page.getByRole('button', { name: 'OK', exact: true });
  if (await ok.count()) await ok.first().click().catch(() => {});
  await page.locator('button:has(svg[aria-label="Select Crop"])').first().click({ timeout: 30000 });
  await page.locator(`div[role="button"]:has-text("${ratio}")`).first().click();
  await sleep(800);
  for (let i = 0; i < 2; i++) {
    await page.locator('div[role="button"]:text-is("Next")').first().click();
    await sleep(2500);
  }
  const box = page.locator('div[aria-label="Write a caption..."], div[aria-label="Add a caption..."]').first();
  await box.click();
  await box.fill(caption);
  await sleep(1000);
  if (process.env.DRY) { console.log(JSON.stringify({ dryRun: true, files: files.length, ratio })); return null; }
  await page.locator('div[role="button"]:text-is("Share")').first().click();
  // wait for Instagram to finish (the dialog says it was shared, or closes)
  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    const done = await page.getByText(/has been shared|Post shared|Reel shared/i).count();
    const dialog = await page.locator('div[role="dialog"]').count();
    if (done || !dialog) break;
  }
  return recent(page, 1);
}

async function recent(page, n = 6) {
  await page.goto(`https://www.instagram.com/${USER}/`, { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  const links = await page.$$eval('a[href*="/p/"], a[href*="/reel/"]', (as) => [...new Set(as.map((a) => a.href))]);
  return links.slice(0, n);
}

async function main() {
  const [cmd, ...a] = process.argv.slice(2);
  const { browser, page } = await open();
  try {
    await login(page);
    let out;
    if (cmd === 'check') out = { loggedIn: true, profile: (await recent(page, 3)) };
    else if (cmd === 'recent') out = await recent(page, Number(a[0] || 6));
    else if (cmd === 'carousel') {
      const files = a.slice(1).map((f) => path.resolve(f));
      if (files.length < 2 || files.length > 10) throw new Error('A carousel needs 2-10 images');
      out = await create(page, files, '4:5', fs.readFileSync(a[0], 'utf8').trim().slice(0, 2200));
    } else if (cmd === 'reel') {
      out = await create(page, [path.resolve(a[1])], 'Original', fs.readFileSync(a[0], 'utf8').trim().slice(0, 2200));
    } else throw new Error('Unknown command. See the top of scripts/ig-web.js.');
    console.log(JSON.stringify(out, null, 2));
  } catch (e) {
    await debugShot(page, cmd || 'run');
    console.error(e.message);
    process.exitCode = e.code === 3 ? 3 : 1;
  } finally {
    await browser.close();
  }
}

main();
