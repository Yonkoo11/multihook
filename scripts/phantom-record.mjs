/**
 * MetaHook demo screen-recording harness.
 *
 * Drives the live demo on devnet through real Phantom popups while
 * recording the dApp page to MP4. The output is the raw screen capture;
 * audio overlay happens later in ffmpeg.
 *
 * Reuses the persistent Chrome profile + Phantom CRX from phantom-e2e.mjs
 * so onboarding is done once and we just unlock + go.
 *
 * Outputs:
 *   video/raw-recording.mp4         — silent video of the live demo run
 *   scripts/screens/record-*.png    — debug screenshots at major beats
 *
 * Pacing: each step has a deliberate post-action sleep so the camera
 * lingers on each verdict rather than flashing past. Total recording
 * length is targeted at ~85s to match the voiceover budget.
 */

import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { PuppeteerScreenRecorder } from "puppeteer-screen-recorder";

// -- config ------------------------------------------------------------------

const PHANTOM_ID = "bfnaelmomeimhlpmgjnjophhpkkoljpa";
const PHANTOM_KEY_FILE = process.env.PHANTOM_KEY_FILE ?? "/tmp/phantom-test-key.b58";
const DEMO_URL = process.env.DEMO_URL ?? "https://yonkoo11.github.io/multihook/";
const PROFILE_DIR = process.env.PROFILE_DIR ?? "/tmp/multihook-phantom-profile";
const EXT_DIR = process.env.EXT_DIR ?? "/tmp/phantom-crx/unpacked";
const PHANTOM_PASSWORD = process.env.PHANTOM_PASSWORD ?? "PhantomTest!2026Demo";

const PROJECT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const VIDEO_DIR = path.join(PROJECT_ROOT, "video");
const SCREENS_DIR = path.join(PROJECT_ROOT, "scripts", "screens");
const RECORDING_OUT = path.join(VIDEO_DIR, "raw-recording.mp4");

fs.mkdirSync(VIDEO_DIR, { recursive: true });
fs.mkdirSync(SCREENS_DIR, { recursive: true });

// 1920x1080 at 30fps, no audio (we composite audio in ffmpeg).
const RECORDER_OPTIONS = {
  fps: 30,
  videoFrame: { width: 1920, height: 1080 },
  videoCrf: 18,
  videoCodec: "libx264",
  videoPreset: "medium",
  videoBitrate: 1000,
  aspectRatio: "16:9",
};

// -- pacing budget -----------------------------------------------------------
// Each beat targets approximately the voiceover-clip duration so the audio
// overlay drops in at the right moment without further re-timing.

const PACE = {
  HERO_LINGER:        8500,   // clip 01 ≈ 8.1s — landing fold
  TRANSITION:         600,
  PROBLEM_SCROLL:     2000,
  PROBLEM_LINGER:     12500,  // clip 02 ≈ 14.4s
  DEMO_TRANSITION:    2000,
  CONNECT_LINGER:     5000,   // clip 03 head: shows wallet pill
  PROVISION_LINGER:   10000,  // clip 03 tail + provision settle
  REJECT_LINGER:      11500,  // clip 04 ≈ 11.8s
  ALLOWLIST_LINGER:   8000,
  APPROVE_LINGER:     14000,  // clip 05 ≈ 14.2s
  SPONSORS_TRANSITION:1500,
  SPONSORS_LINGER:    14500,  // clip 06 ≈ 16.1s
  CLOSE_LINGER:       8000,   // clip 07 ≈ 7.8s
};

// -- chrome / phantom helpers (extracted from phantom-e2e.mjs) ---------------

function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const root = path.join(os.homedir(), ".cache/puppeteer/chrome");
  if (!fs.existsSync(root)) throw new Error("no chrome in ~/.cache/puppeteer");
  const versions = fs.readdirSync(root).filter((d) => d.startsWith("mac"));
  for (const v of versions) {
    const p = path.join(root, v, "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
    if (fs.existsSync(p)) return p;
  }
  throw new Error("no chrome-for-testing found in " + root);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let stepNum = 0;
async function snap(page, name) {
  const file = path.join(SCREENS_DIR, `record-${String(++stepNum).padStart(2, "0")}-${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: false });
  } catch (e) {
    console.warn(`  (snap failed: ${e.message})`);
  }
}

function log(msg) { console.log(`\n▶ ${msg}`); }

async function waitForText(page, text, { timeout = 30000, exact = false } = {}) {
  await page.waitForFunction(
    (t, isExact) => {
      const norm = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();
      const target = norm(t);
      const all = document.querySelectorAll('button, a, [role="button"], div, span, label, h1, h2, h3, p');
      for (const el of all) {
        const txt = norm(el.textContent ?? "");
        if (!txt) continue;
        const match = isExact ? txt === target : txt.includes(target);
        if (match && el.offsetParent !== null) return true;
      }
      return false;
    },
    { timeout, polling: 250 },
    text,
    exact
  );
}

async function clickText(page, text, { timeout = 30000, exact = false, requireEnabled = false } = {}) {
  await waitForText(page, text, { timeout, exact });
  const clicked = await page.evaluate(
    (t, isExact, mustBeEnabled) => {
      const norm = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();
      const target = norm(t);
      const isDisabled = (el) => {
        if (el.disabled) return true;
        if (el.getAttribute("aria-disabled") === "true") return true;
        const cs = window.getComputedStyle(el);
        if (cs.pointerEvents === "none" || parseFloat(cs.opacity) < 0.5) return true;
        return false;
      };
      const sel = ['button', 'a', '[role="button"]', '[type="submit"]', 'label', 'span', 'div'];
      for (const s of sel) {
        const els = Array.from(document.querySelectorAll(s));
        for (const el of els) {
          const txt = norm(el.textContent ?? "");
          if (!txt) continue;
          const match = isExact ? txt === target : txt.includes(target);
          if (match && el.offsetParent !== null) {
            if (mustBeEnabled && isDisabled(el)) continue;
            el.scrollIntoView({ block: "center" });
            el.click();
            return true;
          }
        }
      }
      return false;
    },
    text, exact, requireEnabled
  );
  if (!clicked) throw new Error(`could not click text "${text}"`);
}

async function clickWhenEnabled(page, text, { timeout = 30000, exact = false } = {}) {
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < timeout) {
    try {
      await clickText(page, text, { timeout: 2000, exact, requireEnabled: true });
      return;
    } catch (e) {
      lastErr = e;
      await sleep(300);
    }
  }
  throw lastErr ?? new Error(`button "${text}" never became enabled`);
}

const _seenPopupTargets = new Set();

async function waitForPhantomPopup(browser, { timeout = 25000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const targets = browser.targets();
    const phantomTarget = targets.find((t) => {
      const url = t.url();
      const id = t._targetId ?? url;
      return url.startsWith(`chrome-extension://${PHANTOM_ID}/`) &&
             (url.includes("notification") || url.includes("popup")) &&
             !_seenPopupTargets.has(id);
    });
    if (phantomTarget) {
      const id = phantomTarget._targetId ?? phantomTarget.url();
      _seenPopupTargets.add(id);
      const popup = await phantomTarget.page();
      if (popup) {
        await popup.waitForFunction(() => document.body && document.body.innerText.length > 5, { timeout: 10000 }).catch(() => {});
        popup.on("close", () => _seenPopupTargets.delete(id));
        return popup;
      }
    }
    await sleep(250);
  }
  return null;
}

async function approvePopup(browser, demoPage, { label, approvalText = "Approve", timeout = 25000 } = {}) {
  log(`waiting for Phantom popup [${label}]`);
  const popup = await waitForPhantomPopup(browser, { timeout });
  if (!popup) throw new Error(`Phantom popup [${label}] never opened`);

  await popup.bringToFront();
  await sleep(400);
  const vp = popup.viewport() ?? { width: 380, height: 600 };
  await popup.mouse.click(vp.width / 2, vp.height / 2);
  await sleep(400);
  for (let i = 0; i < 12; i++) {
    const locked = await popup.evaluate(() =>
      (document.body?.innerText ?? "").toLowerCase().includes("click this dialog")
    );
    if (!locked) break;
    await popup.mouse.click(vp.width / 2, vp.height / 2);
    await sleep(500);
  }

  const blocked = await popup.evaluate(() =>
    (document.body?.innerText ?? "").toLowerCase().includes("request blocked")
  );
  if (blocked) {
    console.log(`  Phantom flagged dApp; proceeding`);
    await clickText(popup, "Proceed anyway", { timeout: 5000 });
    await sleep(1500);
  }

  const tries = [approvalText, "Confirm", "Connect", "Approve"];
  let ok = false;
  for (const t of tries) {
    try {
      await clickWhenEnabled(popup, t, { timeout: 20000 });
      ok = true;
      console.log(`  approved with "${t}"`);
      break;
    } catch {}
  }
  if (!ok) throw new Error(`no enabled approval button found in [${label}] popup`);
  await sleep(800);
  // Bring the demo page back into focus so the recording stays on it.
  await demoPage.bringToFront();
}

async function unlockPhantomIfLocked(browser) {
  // Open the popup; if a password input is present, type and Unlock.
  const popup = await browser.newPage();
  await popup.setViewport({ width: 380, height: 600 });
  await popup.goto(`chrome-extension://${PHANTOM_ID}/popup.html`, { waitUntil: "domcontentloaded" });
  await sleep(1500);
  const needsUnlock = await popup.evaluate(() => {
    const t = (document.body?.innerText ?? "").toLowerCase();
    return t.includes("unlock") || t.includes("welcome back") || !!document.querySelector('input[type="password"]');
  });
  if (needsUnlock) {
    log("unlocking Phantom");
    await popup.type('input[type="password"]', PHANTOM_PASSWORD, { delay: 30 });
    await clickText(popup, "Unlock");
    await sleep(2500);
  }
  await popup.close();
}

// -- closing-card overlay ----------------------------------------------------

async function paintClosingCard(page) {
  await page.evaluate(() => {
    const mkEl = (tag, css, text) => {
      const el = document.createElement(tag);
      if (css) el.style.cssText = css;
      if (text != null) el.textContent = text;
      return el;
    };
    document.querySelectorAll("body > *").forEach((n) => (n.style.display = "none"));

    const card = mkEl(
      "div",
      `position: fixed; inset: 0; display: flex; flex-direction: column;
       align-items: center; justify-content: center;
       background:
         radial-gradient(1200px 700px at 80% -8%, rgba(59, 102, 255, 0.20), transparent 60%),
         radial-gradient(900px 600px at -10% 30%, rgba(59, 102, 255, 0.10), transparent 60%),
         radial-gradient(900px 700px at 50% 110%, rgba(59, 102, 255, 0.08), transparent 60%),
         #0a0c12;
       font-family: 'Geist', 'Inter', -apple-system, system-ui, sans-serif;
       color: #e8eaef;
       z-index: 999999;`,
      ""
    );

    const logoRow = mkEl("div", "display:flex; align-items:center; gap:20px; margin-bottom: 28px;", "");
    const mark = mkEl(
      "div",
      `width: 88px; height: 88px;
       display: flex; align-items: center; justify-content: center;
       border: 2px solid #3b66ff; color: #3b66ff;
       border-radius: 14px;
       font-family: 'Geist Mono', ui-monospace, monospace;
       font-size: 56px; font-weight: 600;
       background: rgba(59, 102, 255, 0.10);
       box-shadow: 0 0 40px rgba(59, 102, 255, 0.30);`,
      "M"
    );
    const wordmark = mkEl("div", "font-size: 88px; font-weight: 700; letter-spacing: -0.04em;", "MetaHook");
    logoRow.appendChild(mark);
    logoRow.appendChild(wordmark);
    card.appendChild(logoRow);

    const tagline = mkEl(
      "div",
      `font-family: 'Geist', sans-serif;
       font-size: 30px; color: #9aa1b3; max-width: 1200px; text-align: center;
       line-height: 1.35; letter-spacing: -0.015em; margin-bottom: 56px;`,
      ""
    );
    tagline.appendChild(document.createTextNode("Compose your compliance stack the same way you"));
    tagline.appendChild(mkEl("br", "", ""));
    tagline.appendChild(document.createTextNode("compose middleware in Express."));
    card.appendChild(tagline);

    const links = mkEl(
      "div",
      `display: flex; gap: 28px;
       font-family: 'Geist Mono', ui-monospace, monospace;
       font-size: 24px; color: #5a82ff;`,
      ""
    );
    links.appendChild(mkEl("span", "", "yonkoo11.github.io/multihook"));
    links.appendChild(mkEl("span", "color:#5d6478", "·"));
    links.appendChild(mkEl("span", "", "github.com/Yonkoo11/multihook"));
    card.appendChild(links);

    document.body.appendChild(card);
  });
}

// -- main recording flow -----------------------------------------------------

async function recordFlow(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // ---- Pre-roll: navigate to landing BEFORE starting the recorder so the
  // first frame the recorder captures is the rendered hero, not a blank tab.
  log("loading landing page (pre-roll)");
  await page.goto(DEMO_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(
    () => document.querySelector(".pipeline-svg, .hero, h1") != null,
    { timeout: 15000 }
  );
  await sleep(1500);
  await page.bringToFront();

  // ---- Start recording ----
  const recorder = new PuppeteerScreenRecorder(page, RECORDER_OPTIONS);
  await recorder.start(RECORDING_OUT);
  log(`recording started -> ${RECORDING_OUT}`);

  try {
    // === Beat 01: HERO ===
    log(`beat 01 hero linger (${PACE.HERO_LINGER}ms)`);
    await snap(page, "01-hero");
    await sleep(PACE.HERO_LINGER);

    // === Beat 02: PROBLEM (scroll to "The Problem" section) ===
    log("beat 02 scroll to problem");
    await page.evaluate(() => window.scrollTo({ top: 750, left: 0, behavior: "smooth" }));
    await sleep(PACE.PROBLEM_SCROLL);
    await snap(page, "02-problem");
    await sleep(PACE.PROBLEM_LINGER - PACE.PROBLEM_SCROLL);

    // === Transition: Demo ===
    log("transition to demo page");
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
    await page.goto(DEMO_URL.replace(/\/?$/, "/") + "demo/", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForFunction(
      () => document.querySelector("#provisionBtn") != null,
      { timeout: 15000 }
    );
    await sleep(PACE.DEMO_TRANSITION);
    await snap(page, "03-demo-loaded");

    // === Beat 03: CONNECT + PROVISION ===
    log("beat 03 connect + provision");
    // Eager-connect race — wait briefly to see if Phantom auto-connects
    await sleep(1500);
    let connected = await page.evaluate(() => !!document.querySelector(".wallet-pill"));
    if (!connected) {
      log("clicking Connect Phantom");
      const popupPromise = approvePopup(browser, page, { label: "connect", approvalText: "Connect" }).catch((e) => e);
      try {
        await page.click("#connectBtn");
      } catch (e) {
        console.log(`  (connect click race: ${e.message})`);
      }
      await popupPromise;
    } else {
      log("wallet auto-connected");
    }
    await page.waitForFunction(
      () => document.querySelector(".wallet-pill")?.textContent?.includes("devnet"),
      { timeout: 15000 }
    );
    await page.waitForFunction(
      () => !document.getElementById("provisionBtn")?.disabled,
      { timeout: 30000 }
    );
    await sleep(PACE.CONNECT_LINGER);

    // Reset state for a clean recording: nuke localStorage + reload
    log("resetting demo state for clean recording");
    await page.evaluate(() => {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("multihook:demo:")) localStorage.removeItem(k);
      });
    });
    await page.goto(DEMO_URL.replace(/\/?$/, "/") + "demo/", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForFunction(
      () => document.querySelector(".wallet-pill")?.textContent?.includes("devnet"),
      { timeout: 25000 }
    );
    await page.waitForFunction(
      () => !document.getElementById("provisionBtn")?.disabled,
      { timeout: 30000 }
    );
    await snap(page, "04-pre-provision");

    // Click Provision and approve the (single, batched) Phantom popup. The
    // dApp bundles all 7-10 setup instructions into ONE Confirm Transactions
    // popup. Phantom needs ~10-20s to simulate the bundle before its Confirm
    // button enables. Use the proven approach from phantom-e2e.mjs: poll for
    // "provision complete" while attempting up to 6 popup approvals.
    log("clicking Provision");
    await page.click("#provisionBtn");
    let popupCount = 0;
    while (popupCount < 6) {
      const status = await page.evaluate(() =>
        (document.getElementById("provisionLog")?.textContent ?? "").slice(-300)
      );
      if (status.includes("provision complete")) { log("provision complete"); break; }
      try {
        await approvePopup(browser, page, { label: `provision-${++popupCount}`, approvalText: "Confirm", timeout: 25000 });
      } catch (e) {
        console.log(`  no popup yet (${e.message}); sleeping 2s`);
        await sleep(2000);
      }
    }
    await page.waitForFunction(
      () => (document.getElementById("provisionLog")?.textContent ?? "").includes("provision complete"),
      { timeout: 60000 }
    );
    await snap(page, "05-provisioned");
    await sleep(PACE.PROVISION_LINGER);

    // === Beat 04: REJECT ===
    log("beat 04 send 100 expect reject");
    await page.click("#transferFailBtn");
    await approvePopup(browser, page, { label: "fail-transfer", approvalText: "Confirm" });
    await page.waitForFunction(
      () => (document.getElementById("transferFailLog")?.textContent ?? "").includes("policy.allowlist.fail"),
      { timeout: 30000 }
    );
    await snap(page, "06-rejected");
    await sleep(PACE.REJECT_LINGER);

    // === Beat 05a: ALLOWLIST ===
    log("beat 05a add to allowlist");
    await page.click("#addAllowBtn");
    await approvePopup(browser, page, { label: "add-allow", approvalText: "Confirm" });
    await page.waitForFunction(
      () => (document.getElementById("addAllowLog")?.textContent ?? "").includes("added to allowlist"),
      { timeout: 30000 }
    );
    await snap(page, "07-allowlisted");
    await sleep(PACE.ALLOWLIST_LINGER);

    // === Beat 05b: APPROVE + AUDIT EVENT ===
    log("beat 05b retry expect approve");
    await page.click("#transferOkBtn");
    await approvePopup(browser, page, { label: "ok-transfer", approvalText: "Confirm" });
    await page.waitForFunction(
      () => (document.getElementById("transferOkLog")?.textContent ?? "").includes("MetaHookAuditEvent decoded"),
      { timeout: 45000 }
    );
    // Scroll to bring the audit receipt into frame
    await page.evaluate(() => {
      const el = document.getElementById("auditEventBox");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    await snap(page, "08-approved");
    await sleep(PACE.APPROVE_LINGER);

    // === Beat 06: SPONSORS DEPTH AUDIT ===
    log("beat 06 sponsors page");
    await page.goto(DEMO_URL.replace(/\/?$/, "/") + "sponsors/", { waitUntil: "domcontentloaded", timeout: 20000 });
    await sleep(PACE.SPONSORS_TRANSITION);
    await snap(page, "09-sponsors");
    // Slow scroll through the table for visual variety
    await page.evaluate(async () => {
      const dur = 11000;
      const start = performance.now();
      while (performance.now() - start < dur) {
        window.scrollBy({ top: 1, left: 0, behavior: "instant" });
        await new Promise((r) => setTimeout(r, 16));
      }
    });
    await sleep(PACE.SPONSORS_LINGER - 11000);

    // === Beat 07: CLOSE CARD ===
    log("beat 07 closing card");
    await page.goto(DEMO_URL, { waitUntil: "domcontentloaded", timeout: 20000 });
    await paintClosingCard(page);
    await snap(page, "10-close");
    await sleep(PACE.CLOSE_LINGER);

  } finally {
    await recorder.stop();
    log("recording stopped");
  }
}

async function main() {
  if (!fs.existsSync(PHANTOM_KEY_FILE)) throw new Error(`missing ${PHANTOM_KEY_FILE}`);
  if (!fs.existsSync(EXT_DIR)) throw new Error(`missing ${EXT_DIR}`);

  const chrome = findChrome();
  console.log(`chrome:    ${chrome}`);
  console.log(`profile:   ${PROFILE_DIR}`);
  console.log(`extension: ${EXT_DIR}`);
  console.log(`demo:      ${DEMO_URL}`);
  console.log(`output:    ${RECORDING_OUT}`);

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
      "--disable-features=DialMediaRouteProvider",
    ],
  });

  await sleep(2000);

  try {
    await unlockPhantomIfLocked(browser);
    await recordFlow(browser);
    console.log(`\n🎬 RECORDING DONE -> ${RECORDING_OUT}`);
  } catch (e) {
    console.error(`\n❌ recording failed:`, e.message);
    console.error(e.stack);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
