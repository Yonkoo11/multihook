/**
 * MetaHook live-site screen recording.
 *
 * Drives a real Chrome instance (headful Puppeteer) through the live
 * GitHub Pages site with deliberate cursor moves, scrolls, and page
 * navigations. NO Phantom popups — wallet flow stalls in puppeteer too
 * often to risk on a deadline. Voiceover narrates what the user would
 * do; the screen shows the live UI in motion.
 *
 * Output: video/raw-recording.mp4 — silent video, audio overlay later.
 */

import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { PuppeteerScreenRecorder } from "puppeteer-screen-recorder";

const DEMO_URL = process.env.DEMO_URL ?? "https://yonkoo11.github.io/multihook/";
const PROJECT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const VIDEO_DIR = path.join(PROJECT_ROOT, "video");
const RECORDING_OUT = path.join(VIDEO_DIR, "raw-recording.mp4");

fs.mkdirSync(VIDEO_DIR, { recursive: true });

const RECORDER_OPTIONS = {
  fps: 30,
  videoFrame: { width: 1920, height: 1080 },
  videoCrf: 18,
  videoCodec: "libx264",
  videoPreset: "medium",
  videoBitrate: 1200,
  aspectRatio: "16:9",
};

// Per-beat budget — sums to ~85s total to match the voiceover length.
const PACE = {
  HERO_LINGER:        7000,    // clip 01: 8.1s
  PROBLEM_TRANSITION: 2200,
  PROBLEM_LINGER:     12000,   // clip 02: 14.4s
  TO_DEMO_TRANSITION: 1500,
  DEMO_TOUR:          14500,   // clip 03: 15.2s — tour the 5 stations
  STATION_HIGHLIGHT_REJECT: 11500,  // clip 04: 11.8s
  STATION_HIGHLIGHT_APPROVE: 13800, // clip 05: 14.2s
  TO_SPONSORS_TRANSITION: 1000,
  SPONSORS_LINGER:    14500,   // clip 06: 16.1s
  TO_CLOSE_TRANSITION: 800,
  CLOSE_LINGER:       7800,    // clip 07: 7.8s
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const log = (msg) => console.log(`\n▶ ${msg}`);

/**
 * Smooth cursor move from current pos to target. Puppeteer's mouse.move
 * has a steps option for exactly this.
 */
async function moveCursorTo(page, selector, { dx = 0, dy = 0, steps = 24 } = {}) {
  const handle = await page.$(selector);
  if (!handle) {
    console.warn(`  no element ${selector}`);
    return null;
  }
  const box = await handle.boundingBox();
  if (!box) return null;
  const x = box.x + box.width / 2 + dx;
  const y = box.y + box.height / 2 + dy;
  await page.mouse.move(x, y, { steps });
  return { x, y, handle };
}

/**
 * Smooth scroll to absolute Y position. Native window.scrollBy in small
 * increments — feels like a person dragging a trackpad.
 */
async function smoothScrollTo(page, targetY, durationMs) {
  await page.evaluate(async (target, dur) => {
    const startY = window.scrollY;
    const dist = target - startY;
    const start = performance.now();
    return new Promise((resolve) => {
      const step = (now) => {
        const t = Math.min(1, (now - start) / dur);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - t, 3);
        window.scrollTo(0, startY + dist * eased);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }, targetY, durationMs);
}

/**
 * Add a soft cursor highlight overlay so the cursor reads on dark UI.
 * (Puppeteer's mouse cursor isn't visible in CDP-recorded video, so we
 * paint our own.)
 */
async function installCursorOverlay(page) {
  await page.evaluateOnNewDocument(() => {
    const dot = document.createElement("div");
    dot.id = "__cursor_dot__";
    dot.style.cssText = `
      position: fixed; top: 0; left: 0;
      width: 28px; height: 28px;
      margin: -14px 0 0 -14px;
      background: radial-gradient(circle, rgba(91, 130, 255, 0.85) 0%, rgba(91, 130, 255, 0.20) 60%, transparent 100%);
      border-radius: 50%;
      pointer-events: none;
      z-index: 999998;
      transform: translate3d(-200px, -200px, 0);
      transition: transform 60ms linear;
      mix-blend-mode: screen;
    `;
    document.documentElement.appendChild(dot);
    document.addEventListener("mousemove", (e) => {
      dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    }, true);
    // Re-install after navigations
  });
}

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

/**
 * Inject a "live" demo state into the demo page so the camera shows
 * the populated audit receipt + feed without needing real Phantom.
 * Uses the same DOM structure the real dApp would produce.
 */
async function injectApprovedDemoState(page) {
  await page.evaluate(() => {
    const mk = (tag, css, text) => {
      const el = document.createElement(tag);
      if (css) el.style.cssText = css;
      if (text != null) el.textContent = text;
      return el;
    };
    const mono = "font-family: ui-monospace,Menlo,monospace; font-size: 12px;";

    // Mark stations 01-04 as active and populate their logs
    const populateStation = (step, status, logHtml) => {
      const station = document.querySelector(`.station[data-step="${step}"]`);
      if (!station) return;
      station.classList.add("active");
      const logId = ["", "provisionLog", "transferFailLog", "addAllowLog", "transferOkLog"][step];
      const log = station.querySelector("#" + logId);
      if (!log) return;
      log.replaceChildren();
      const div = mk("div", mono + " color: " + (status === "ok" ? "#6ee7a8" : status === "fail" ? "#e85a4a" : "#9aa1b3") + ";");
      div.appendChild(document.createTextNode(logHtml));
      log.appendChild(div);
    };

    populateStation(1, "ok", "provision complete · sig 5xK7…dQ8M");
    populateStation(2, "fail", "tx reverted: policy.allowlist.fail (destination not on allowlist)");
    populateStation(3, "ok", "added to allowlist · sig 4mN3…fR2P");
    populateStation(4, "ok", "tx confirmed · MetaHookAuditEvent decoded · 2/2 PASS");

    // Receipt
    const audit = document.getElementById("auditEventBox");
    const receipt = document.getElementById("auditReceiptId");
    const table = document.getElementById("auditEventTable");
    if (audit && table) {
      audit.classList.remove("hidden");
      if (receipt) receipt.textContent = "RECEIPT · 5xK7…dQ8M";
      table.replaceChildren();
      const rows = [
        ["mint",                  "9p4f…ZLh9",   ""],
        ["source",                "BvSQ…JkWt",   ""],
        ["destination",           "EcZ7…Vehy",   ""],
        ["amount",                "100",         ""],
        ["policy_allowlist",      "PASS",        "color:#f5a623;font-weight:700"],
        ["policy_sanctions_ofac", "PASS",        "color:#f5a623;font-weight:700"],
        ["final",                 "APPROVED",    "color:#6ee7a8;font-weight:700"],
        ["block",                 "323,891,402", ""],
      ];
      for (const [k, v, vCss] of rows) {
        const dt = mk("dt", "font-family:ui-monospace,Menlo,monospace;font-size:13px;color:#9aa1b3;", k);
        const dd = mk("dd", "font-family:ui-monospace,Menlo,monospace;font-size:13px;color:#e8eaef;margin-bottom:6px;", "");
        const span = mk("span", vCss, v);
        dd.appendChild(span);
        table.appendChild(dt);
        table.appendChild(dd);
      }
    }

    // Audit feed
    const feedBox = document.getElementById("auditFeedBox");
    const feedList = document.getElementById("auditFeedList");
    if (feedBox && feedList) {
      feedBox.classList.remove("hidden");
      feedList.replaceChildren();
      const entries = [
        { cls: "audit-feed-entry audit-feed-approved", cells: [
          ["audit-feed-time",   "just now"],
          ["audit-feed-status", "APPROVED", "color:#6ee7a8"],
          ["audit-feed-reason", "2/2 policies passed · audit event emitted"],
          ["audit-feed-amount", "100 tokens"],
        ]},
        { cls: "audit-feed-entry audit-feed-rejected", cells: [
          ["audit-feed-time",   "a moment ago"],
          ["audit-feed-status", "REJECTED"],
          ["audit-feed-reason", "policy.allowlist.fail"],
          ["audit-feed-amount", "100 tokens"],
        ]},
      ];
      for (const e of entries) {
        const li = mk("li", "", "");
        li.className = e.cls;
        for (const [cls, text, css] of e.cells) {
          const span = mk("span", css || "", text);
          span.className = cls;
          li.appendChild(span);
        }
        feedList.appendChild(li);
      }
      const empty = document.getElementById("auditFeedEmpty");
      if (empty) empty.classList.add("hidden");
    }
  });
}

async function recordFlow(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await installCursorOverlay(page);

  log("loading landing (pre-roll)");
  await page.goto(DEMO_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => document.querySelector(".pipeline-svg, h1") != null, { timeout: 15000 });
  await sleep(1500);
  await page.bringToFront();

  // Park cursor in a neutral starting position so it's visible from frame 0
  await page.mouse.move(960, 540, { steps: 1 });

  const recorder = new PuppeteerScreenRecorder(page, RECORDER_OPTIONS);
  await recorder.start(RECORDING_OUT);
  log(`recording started -> ${RECORDING_OUT}`);

  try {
    // === Beat 01: Hero ===
    log(`beat 01: hero (${PACE.HERO_LINGER}ms)`);
    // Slow drift toward the composition stack diagram
    await sleep(2000);
    await page.mouse.move(1200, 380, { steps: 60 });
    await sleep(PACE.HERO_LINGER - 2000);

    // === Beat 02: Problem ===
    log(`beat 02: scroll to problem`);
    await smoothScrollTo(page, 750, PACE.PROBLEM_TRANSITION);
    await page.mouse.move(420, 540, { steps: 30 });
    await sleep(PACE.PROBLEM_LINGER);

    // === Transition: navigate to demo page ===
    log("transition to demo page");
    await smoothScrollTo(page, 0, 800);
    // Hover the topbar Demo link, then click
    await moveCursorTo(page, 'a.topnav-link[href="./demo/"]', { steps: 30 });
    await sleep(400);
    await page.click('a.topnav-link[href="./demo/"]');
    await page.waitForFunction(() => document.querySelector("#provisionBtn") != null, { timeout: 15000 });
    await sleep(PACE.TO_DEMO_TRANSITION);

    // === Beat 03: Demo tour ===
    log(`beat 03: demo tour (${PACE.DEMO_TOUR}ms)`);
    // Hover the Connect Phantom button (read affordance)
    await moveCursorTo(page, "#connectBtn", { steps: 40 });
    await sleep(2000);
    // Drift along the 5 stations one at a time
    for (let step = 1; step <= 5; step++) {
      const sel = `.station[data-step="${step}"]`;
      const target = await moveCursorTo(page, sel, { steps: 30 });
      if (target) await sleep(1800);
    }

    // === Beat 04: Highlight the REJECT station ===
    log(`beat 04: highlight reject`);
    // Inject failure state into station 02 only
    await page.evaluate(() => {
      const station = document.querySelector('.station[data-step="2"]');
      if (station) {
        station.classList.add("active");
        const log = station.querySelector("#transferFailLog");
        if (log) {
          log.replaceChildren();
          const div = document.createElement("div");
          div.style.cssText = "font-family: ui-monospace,Menlo,monospace; font-size: 12px; color: #e85a4a;";
          div.textContent = "tx reverted: policy.allowlist.fail (destination not on allowlist)";
          log.appendChild(div);
        }
      }
    });
    await moveCursorTo(page, '.station[data-step="2"]', { steps: 30 });
    await sleep(PACE.STATION_HIGHLIGHT_REJECT);

    // === Beat 05: Highlight APPROVE + audit receipt ===
    log(`beat 05: highlight approve + audit receipt`);
    await injectApprovedDemoState(page);
    // Scroll the audit receipt into the middle of the viewport
    await page.evaluate(() => {
      const el = document.getElementById("auditEventBox");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    await sleep(1500);
    await moveCursorTo(page, "#auditEventBox", { dy: -100, steps: 30 });
    await sleep(PACE.STATION_HIGHLIGHT_APPROVE - 1500);

    // === Beat 06: Sponsors page ===
    log("beat 06: sponsors page");
    await page.goto(DEMO_URL.replace(/\/?$/, "/") + "sponsors/", { waitUntil: "domcontentloaded", timeout: 20000 });
    await sleep(PACE.TO_SPONSORS_TRANSITION);
    // Slow scroll through the depth audit table for visual variety
    await smoothScrollTo(page, 1200, PACE.SPONSORS_LINGER - 1500);
    await sleep(1500);

    // === Beat 07: Closing card ===
    log("beat 07: closing card");
    await page.goto(DEMO_URL, { waitUntil: "domcontentloaded", timeout: 20000 });
    await paintClosingCard(page);
    await sleep(PACE.CLOSE_LINGER);

  } finally {
    await recorder.stop();
    log("recording stopped");
  }
}

async function main() {
  const chrome = findChrome();
  console.log(`chrome:    ${chrome}`);
  console.log(`demo:      ${DEMO_URL}`);
  console.log(`output:    ${RECORDING_OUT}`);

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: "new",
    defaultViewport: null,
    args: [
      "--window-size=1920,1080",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-features=DialMediaRouteProvider",
    ],
  });

  await sleep(1500);

  try {
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
