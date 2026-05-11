#!/usr/bin/env node
/**
 * Path A recording driver — drives the FULL multihook demo flow with REAL
 * Phantom popups visible, optimised for ffmpeg avfoundation screen capture.
 *
 * Differences from phantom-e2e.mjs (the test harness):
 *   - Visits the LANDING page first, scrolls hero + problem section before
 *     navigating to /demo/. Same flow a judge would experience.
 *   - Smooth cursor movements between actions.
 *   - Beat timestamps emitted to a JSON log so the audio composite can be
 *     time-aligned to the actual recording.
 *   - Solscan cutaway after the receipt.
 *   - docs/policies navigation + scroll for clip 07 (compose).
 *   - Closing card overlay at end.
 *
 * Run via record-path-a.sh which wraps this with ffmpeg avfoundation capture.
 *
 * Env:
 *   DEMO_URL          base URL (default http://localhost:4173)
 *   PHANTOM_KEY_FILE  /tmp/phantom-test-key.b58
 *   PROFILE_DIR       /tmp/multihook-phantom-profile
 *   EXT_DIR           /tmp/phantom-crx/unpacked
 *   PHANTOM_PASSWORD  test-wallet password
 *   BEAT_LOG          where to write beat timestamps (default scripts/beats.json)
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const PHANTOM_ID = "bfnaelmomeimhlpmgjnjophhpkkoljpa";
const PHANTOM_KEY_FILE = process.env.PHANTOM_KEY_FILE ?? "/tmp/phantom-test-key.b58";
const DEMO_URL = process.env.DEMO_URL ?? "http://localhost:4173";
const PROFILE_DIR = process.env.PROFILE_DIR ?? "/tmp/multihook-phantom-profile";
const EXT_DIR = process.env.EXT_DIR ?? "/tmp/phantom-crx/unpacked";
const PHANTOM_PASSWORD = process.env.PHANTOM_PASSWORD ?? "PhantomTest!2026Demo";
const BEAT_LOG = process.env.BEAT_LOG ?? path.join(path.dirname(new URL(import.meta.url).pathname), "beats.json");

const t0 = Date.now();
const beats = [];
function beat(name, note = "") {
  const t = (Date.now() - t0) / 1000;
  beats.push({ name, t: Number(t.toFixed(3)), note });
  console.log(`  beat ${t.toFixed(3).padStart(7)}s  ${name.padEnd(28)} ${note}`);
}
function flushBeats() {
  fs.writeFileSync(BEAT_LOG, JSON.stringify({ recorded_at: new Date().toISOString(), total_seconds: (Date.now() - t0) / 1000, beats }, null, 2));
  console.log(`\nbeat log → ${BEAT_LOG}`);
}

function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const root = path.join(os.homedir(), ".cache/puppeteer/chrome");
  if (!fs.existsSync(root)) throw new Error("no chrome in ~/.cache/puppeteer");
  const versions = fs.readdirSync(root).filter((d) => d.startsWith("mac"));
  for (const v of versions) {
    const p = path.join(root, v, "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
    if (fs.existsSync(p)) return p;
  }
  throw new Error("no chrome-for-testing found");
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function smoothScroll(page, distance, durationMs) {
  await page.evaluate(async (distance, durationMs) => {
    const steps = Math.max(20, Math.floor(durationMs / 16));
    const stepMs = durationMs / steps;
    for (let i = 0; i < steps; i++) {
      const t = (i + 1) / steps;
      const prev = i / steps;
      const ease = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
      window.scrollBy(0, distance * (ease(t) - ease(prev)));
      await new Promise(r => setTimeout(r, stepMs));
    }
  }, distance, durationMs);
}

async function smoothMove(page, x, y, durationMs = 600) {
  const steps = Math.max(10, Math.floor(durationMs / 40));
  await page.mouse.move(x, y, { steps });
}

// ---- Phantom popup helpers ----

const _seenPopupTargets = new Set();

async function waitForPhantomPopup(browser, { timeout = 25000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const targets = browser.targets();
    for (const t of targets) {
      const url = t.url();
      if (!url.includes(`chrome-extension://${PHANTOM_ID}`)) continue;
      if (!url.includes("notification.html") && !url.includes("popup.html")) continue;
      if (url.includes("/onboarding")) continue;
      const id = `${t._targetId ?? url}`;
      if (_seenPopupTargets.has(id)) continue;
      _seenPopupTargets.add(id);
      const page = await t.page().catch(() => null);
      if (page) return page;
    }
    await sleep(250);
  }
  throw new Error(`no Phantom popup within ${timeout}ms`);
}

async function approvePopup(browser, { label, approvalText = "Approve", timeout = 25000 } = {}) {
  const popup = await waitForPhantomPopup(browser, { timeout });
  await popup.waitForFunction(
    (text) => [...document.querySelectorAll("button,div[role='button']")]
      .some(b => (b.textContent || "").trim().includes(text) && !b.disabled),
    { timeout },
    approvalText,
  );
  const handle = await popup.evaluateHandle((text) => {
    const candidates = [...document.querySelectorAll("button,div[role='button']")];
    return candidates.find(b => {
      const t = (b.textContent || "").trim();
      const r = b.getBoundingClientRect();
      return t.includes(text) && !b.disabled && r.width > 0;
    }) ?? null;
  }, approvalText);
  const el = handle.asElement();
  if (!el) throw new Error(`approvePopup(${label}): no ${approvalText} button`);
  await el.click();
  beat(`phantom-${label}-approved`);
}

async function openPhantomPopup(browser) {
  const sw = browser.targets().find(t => t.type() === "service_worker" && t.url().includes(PHANTOM_ID));
  if (!sw) return null;
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${PHANTOM_ID}/popup.html`);
  return page;
}

async function unlockOrOnboard(browser) {
  const popup = await openPhantomPopup(browser);
  if (!popup) throw new Error("Phantom service worker not found");

  // Wait up to 15s for Phantom's React UI to actually render. The previous
  // 1.2s sleep tripped on empty/loading DOM and skipped unlock entirely.
  // Three states are possible: (a) onboarding, (b) password-prompt, (c) main
  // wallet UI (already unlocked).
  await Promise.race([
    popup.waitForSelector("input[type='password']", { timeout: 15000 }).catch(() => null),
    popup.waitForFunction(
      () => {
        const t = document.body.innerText.toLowerCase();
        return t.includes("send") && (t.includes("receive") || t.includes("swap"));
      },
      { timeout: 15000 },
    ).catch(() => null),
  ]);

  if (popup.url().includes("/onboarding")) {
    await popup.close().catch(() => {});
    throw new Error("Phantom not onboarded — record-path-a.sh should have onboarded first; profile may be corrupt. Try `rm -rf /tmp/multihook-phantom-profile` and re-run.");
  }

  const hasPwd = await popup.evaluate(() => !!document.querySelector("input[type='password']"));
  if (hasPwd) {
    await popup.type("input[type='password']", PHANTOM_PASSWORD, { delay: 30 });
    // Try Unlock button first (more reliable than Enter on some Phantom versions)
    const unlockBtn = await popup.evaluateHandle(() => {
      return [...document.querySelectorAll("button,div[role='button']")].find(
        b => /^unlock$/i.test((b.textContent || "").trim()) && !b.disabled,
      ) ?? null;
    });
    const btnEl = unlockBtn.asElement();
    if (btnEl) {
      await btnEl.click();
    } else {
      await popup.keyboard.press("Enter");
    }
    // Wait for main wallet UI to confirm unlock succeeded
    const unlocked = await popup.waitForFunction(
      () => {
        const t = document.body.innerText.toLowerCase();
        return t.includes("send") && (t.includes("receive") || t.includes("swap"));
      },
      { timeout: 10000 },
    ).catch(() => null);
    if (!unlocked) {
      await popup.close().catch(() => {});
      throw new Error(`PHANTOM_PASSWORD did not unlock the puppeteer profile. record-path-a.sh wipes + re-onboards on every run; if you see this it means the onboarding step failed silently.`);
    }
    beat("phantom-unlocked");
  } else {
    beat("phantom-already-unlocked");
  }
  await popup.close().catch(() => {});
}

// ---- The recording flow ----

async function runRecording(browser) {
  beat("recording-start");

  // Beat 01-hero (audio 0.5-8.5s)
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(`${DEMO_URL}/`, { waitUntil: "domcontentloaded" });
  beat("landing-loaded");
  await sleep(2000);
  await smoothScroll(page, 800, 6000);
  beat("landing-hero-scrolled");
  await sleep(1000);

  // Beat 02-problem (audio 10-24s)
  await smoothScroll(page, 1400, 9000);
  beat("landing-problem-visible");
  await sleep(3000);

  // Beat 03-connect (audio 32-43s)
  await page.goto(`${DEMO_URL}/demo/`, { waitUntil: "domcontentloaded" });
  beat("demo-page-loaded");
  await page.waitForFunction(
    () => document.getElementById("connectBtn") || document.querySelector(".wallet-pill"),
    { timeout: 15000 },
  );
  await sleep(800);

  let connected = await page.evaluate(() => !!document.querySelector(".wallet-pill"));
  if (!connected) {
    const btn = await page.$("#connectBtn");
    const box = await btn.boundingBox();
    await smoothMove(page, box.x + box.width / 2, box.y + box.height / 2, 700);
    const popupP = approvePopup(browser, { label: "connect", approvalText: "Connect", timeout: 20000 }).catch(e => e);
    await page.click("#connectBtn");
    beat("connect-clicked");
    const r = await popupP;
    if (r instanceof Error) console.log(`  connect popup note: ${r.message}`);
  } else {
    beat("connect-auto");
  }
  await page.waitForFunction(() => document.querySelector(".wallet-pill"), { timeout: 15000 });
  beat("wallet-connected");

  // Reset state for a deterministic provision step
  await page.evaluate(() => {
    Object.keys(localStorage).forEach(k => k.startsWith("multihook:demo:") && localStorage.removeItem(k));
  });
  await page.goto(`${DEMO_URL}/demo/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector(".wallet-pill"), { timeout: 15000 });
  await page.waitForFunction(() => !document.getElementById("provisionBtn")?.disabled, { timeout: 30000 });
  await sleep(1500);

  const pBtn = await page.$("#provisionBtn");
  const pBox = await pBtn.boundingBox();
  await smoothMove(page, pBox.x + pBox.width / 2, pBox.y + pBox.height / 2, 700);
  beat("provision-pre-click");
  await page.click("#provisionBtn");
  beat("provision-clicked");

  let popupN = 0;
  while (popupN < 4) {
    const status = await page.evaluate(() => (document.getElementById("provisionLog")?.textContent ?? "").slice(-300));
    if (status.includes("provision complete")) break;
    if (status.includes("provision failed")) throw new Error("provision failed in dApp");
    try {
      await approvePopup(browser, { label: `provision-${++popupN}`, approvalText: "Confirm", timeout: 20000 });
    } catch (e) {
      console.log(`  no popup yet (${e.message}); waiting…`);
      await sleep(2500);
    }
  }
  await page.waitForFunction(
    () => (document.getElementById("provisionLog")?.textContent ?? "").includes("provision complete"),
    { timeout: 60000 },
  );
  beat("provision-complete");
  await sleep(1500);

  // Beat 04-reject
  const tfBtn = await page.$("#transferFailBtn");
  const tfBox = await tfBtn.boundingBox();
  await smoothMove(page, tfBox.x + tfBox.width / 2, tfBox.y + tfBox.height / 2, 600);
  await page.click("#transferFailBtn");
  beat("transfer-fail-clicked");
  await approvePopup(browser, { label: "fail-tx", approvalText: "Confirm", timeout: 20000 });
  await page.waitForFunction(() => {
    const t = document.getElementById("transferFailLog")?.textContent ?? "";
    return t.includes("policy.allowlist.fail");
  }, { timeout: 30000 });
  beat("transfer-fail-rejected");
  await sleep(1500);

  // Beat 05-allow
  const aBtn = await page.$("#addAllowBtn");
  const aBox = await aBtn.boundingBox();
  await smoothMove(page, aBox.x + aBox.width / 2, aBox.y + aBox.height / 2, 600);
  await page.click("#addAllowBtn");
  beat("add-allow-clicked");
  await approvePopup(browser, { label: "add-allow", approvalText: "Confirm", timeout: 20000 });
  await page.waitForFunction(
    () => document.getElementById("addAllowLog")?.textContent?.includes("added to allowlist"),
    { timeout: 30000 },
  );
  beat("allowlist-added");
  await sleep(1200);

  // Beat 06-approve + receipt
  const okBtn = await page.$("#transferOkBtn");
  const okBox = await okBtn.boundingBox();
  await smoothMove(page, okBox.x + okBox.width / 2, okBox.y + okBox.height / 2, 600);
  await page.click("#transferOkBtn");
  beat("transfer-ok-clicked");
  await approvePopup(browser, { label: "ok-tx", approvalText: "Confirm", timeout: 20000 });
  await page.waitForFunction(() => {
    const t = document.getElementById("transferOkLog")?.textContent ?? "";
    return t.includes("MetaHookAuditEvent decoded") || t.includes("PASS");
  }, { timeout: 45000 });
  beat("transfer-ok-receipt-rendered");
  await sleep(2000);

  await page.evaluate(() => {
    document.getElementById("auditEventBox")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  await sleep(2500);
  beat("receipt-dwell");

  // Pull tx sig from the dApp log for Solscan link
  const okLog = await page.evaluate(() => document.getElementById("transferOkLog")?.textContent ?? "");
  const sigMatch = okLog.match(/[1-9A-HJ-NP-Za-km-z]{60,90}/);
  const sig = sigMatch ? sigMatch[0] : null;

  // Beat 06b — Solscan cutaway
  if (sig) {
    const solscan = await browser.newPage();
    await solscan.setViewport({ width: 1920, height: 1080 });
    await solscan.goto(`https://solscan.io/tx/${sig}?cluster=devnet`, { waitUntil: "domcontentloaded", timeout: 30000 });
    beat("solscan-opened", `tx=${sig.slice(0, 12)}…`);
    await sleep(4000);
    await smoothScroll(solscan, 600, 3000);
    await sleep(2500);
    beat("solscan-dwell");
  } else {
    console.log("  (no tx sig parsed — skipping Solscan cutaway)");
  }

  // Beat 07-compose — docs/policies
  const docsPage = await browser.newPage();
  await docsPage.setViewport({ width: 1920, height: 1080 });
  await docsPage.goto(`${DEMO_URL}/docs/policies/`, { waitUntil: "domcontentloaded" });
  beat("docs-policies-loaded");
  await sleep(2000);
  await smoothScroll(docsPage, 1500, 7000);
  beat("docs-scrolled");
  await sleep(2000);

  // Beat 08-close — closing card overlay
  await docsPage.evaluate(() => {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:linear-gradient(135deg,#0a0e27 0%,#1a1f4a 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999;color:#eaeaea;font-family:system-ui,-apple-system,sans-serif;text-align:center;";
    const h = document.createElement("h1");
    h.textContent = "Multi-Hook";
    h.style.cssText = "font-size:96px;font-weight:700;letter-spacing:-0.04em;margin:0 0 16px;background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;";
    const sub = document.createElement("p");
    sub.textContent = "Composable Token-2022 compliance.";
    sub.style.cssText = "font-size:32px;font-weight:300;margin:0 0 48px;color:#a8a8b8;";
    const cta = document.createElement("p");
    cta.textContent = "yonkoo11.github.io/multihook  ·  github.com/Yonkoo11/multihook";
    cta.style.cssText = "font-size:20px;color:#6366f1;font-family:'SF Mono',Menlo,monospace;letter-spacing:0.02em;";
    overlay.append(h, sub, cta);
    document.body.appendChild(overlay);
  });
  beat("closing-card-shown");
  await sleep(7000);

  beat("recording-end");
}

(async () => {
  if (!fs.existsSync(EXT_DIR)) throw new Error(`missing Phantom CRX at ${EXT_DIR}`);
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const chrome = findChrome();
  console.log(`chrome:    ${chrome}`);
  console.log(`profile:   ${PROFILE_DIR}`);
  console.log(`extension: ${EXT_DIR}`);
  console.log(`demo url:  ${DEMO_URL}`);
  console.log(`beat log:  ${BEAT_LOG}\n`);

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: false,
    userDataDir: PROFILE_DIR,
    defaultViewport: null,
    args: [
      `--disable-extensions-except=${EXT_DIR}`,
      `--load-extension=${EXT_DIR}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=1920,1080",
      "--window-position=0,0",
    ],
  });

  await sleep(2500);

  try {
    await unlockOrOnboard(browser);
    await runRecording(browser);
    console.log("\n✅ recording flow completed");
  } catch (e) {
    console.error(`\n❌ recording flow failed: ${e.message}`);
    console.error(e.stack);
    process.exitCode = 1;
  } finally {
    flushBeats();
    await sleep(2000);
    await browser.close().catch(() => {});
  }
})();
