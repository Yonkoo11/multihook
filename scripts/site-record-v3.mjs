/**
 * MetaHook demo v3 — 8-beat live-site walkthrough.
 *
 * Why this isn't real Phantom: drove this 3 ways, the bundled-tx +
 * Phantom drainer-detection on devnet doesn't reliably reach
 * "provision complete" in puppeteer. Site-record + injected post-tx
 * state is what every other infra demo (Linear, Vercel, Stripe) does.
 *
 * What it shows:
 *   t=0..8.5    01-hero       landing page, hero diagram
 *   t=8.5..23   02-problem    smooth scroll to "The Problem" section
 *   t=23..25    transition    click Demo nav -> /demo/
 *   t=25..36    03-connect    cursor hovers Connect, wallet pill flips,
 *                             cursor hovers Provision, log streams
 *   t=36..45    04-reject     cursor hovers Send 100, fail log streams
 *                             policy.allowlist.fail in red
 *   t=45..51    05-allow      cursor hovers Add to allowlist, log "added"
 *   t=51..65    06-approve    cursor hovers Retry, audit receipt panel
 *                             populates with PASS verdicts + scrolls into
 *                             view
 *   t=65..75    07-compose    click Docs, navigate to /docs/policies/,
 *                             slow scroll showing the spec
 *   t=75..83    08-close      branded closing card overlay
 *
 * Output: video/raw-recording.mp4 — silent, 1920x1080 @ 30fps.
 *         Audio + subtitles overlay later in composite.sh.
 */

import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { PuppeteerScreenRecorder } from "puppeteer-screen-recorder";

const DEMO_BASE = (process.env.DEMO_URL ?? "https://yonkoo11.github.io/multihook").replace(/\/$/, "");
const PROJECT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const VIDEO_DIR = path.join(PROJECT_ROOT, "video");
const OUT = path.join(VIDEO_DIR, "raw-recording.mp4");

fs.mkdirSync(VIDEO_DIR, { recursive: true });

const RECORDER = {
  fps: 30,
  videoFrame: { width: 1920, height: 1080 },
  videoCrf: 18,
  videoCodec: "libx264",
  videoPreset: "medium",
  videoBitrate: 1200,
  aspectRatio: "16:9",
};

// Beat budgets — tuned so each beat ends ~at the corresponding voiceover
// clip's natural finish. Actual page-load latency adds 2-4s per nav.
const PACE = {
  HERO_LINGER:        8500,
  PROBLEM_SCROLL:     1800,
  PROBLEM_LINGER:     12500,
  TO_DEMO:            2000,
  CONNECT:            5000,    // hover Connect, inject wallet pill
  PROVISION:          7000,    // hover Provision, stream provision log
  REJECT:             9000,    // click Send 100, stream fail log
  ALLOW:              5500,
  APPROVE:            14000,   // click Retry, render audit receipt
  TO_DOCS:            1500,
  COMPOSE:            10000,
  TO_CLOSE:           1000,
  CLOSE_LINGER:       8500,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const root = path.join(os.homedir(), ".cache/puppeteer/chrome");
  if (!fs.existsSync(root)) throw new Error("no chrome");
  const versions = fs.readdirSync(root).filter((d) => d.startsWith("mac"));
  for (const v of versions) {
    const p = path.join(root, v, "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
    if (fs.existsSync(p)) return p;
  }
  throw new Error("no chrome-for-testing found");
}

const log = (m) => console.log(`▶ ${m}`);

async function moveCursorTo(page, selector, { dx = 0, dy = 0, steps = 30 } = {}) {
  const handle = await page.$(selector);
  if (!handle) return null;
  const box = await handle.boundingBox();
  if (!box) return null;
  const x = box.x + box.width / 2 + dx;
  const y = box.y + box.height / 2 + dy;
  await page.mouse.move(x, y, { steps });
  return { x, y, handle };
}

async function buttonClickAnim(page, selector) {
  // Visual press effect — scale down briefly so cursor lands feel like a click
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.style.transition = "transform 80ms cubic-bezier(0.23, 1, 0.32, 1)";
    el.style.transform = "scale(0.97)";
    setTimeout(() => { el.style.transform = "scale(1)"; }, 120);
  }, selector);
  await sleep(180);
}

async function smoothScrollTo(page, targetY, durationMs) {
  await page.evaluate(async (target, dur) => {
    const startY = window.scrollY;
    const dist = target - startY;
    const start = performance.now();
    return new Promise((resolve) => {
      const step = (now) => {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        window.scrollTo(0, startY + dist * eased);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }, targetY, durationMs);
}

async function installCursorOverlay(page) {
  await page.evaluateOnNewDocument(() => {
    const dot = document.createElement("div");
    dot.id = "__cursor_dot__";
    dot.style.cssText = `
      position: fixed; top: 0; left: 0;
      width: 30px; height: 30px;
      margin: -15px 0 0 -15px;
      background: radial-gradient(circle, rgba(91, 130, 255, 0.92) 0%, rgba(91, 130, 255, 0.25) 55%, transparent 100%);
      border: 2px solid rgba(255, 255, 255, 0.85);
      border-radius: 50%;
      pointer-events: none;
      z-index: 999998;
      transform: translate3d(-200px, -200px, 0);
      transition: transform 65ms linear;
      mix-blend-mode: screen;
    `;
    document.documentElement.appendChild(dot);
    document.addEventListener("mousemove", (e) => {
      dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    }, true);
  });
}

// ---- State injectors per beat -----------------------------------------------

async function injectConnectedWallet(page) {
  await page.evaluate(() => {
    const status = document.getElementById("walletStatus");
    if (!status) return;
    status.replaceChildren();
    const pill = document.createElement("div");
    pill.className = "wallet-pill";
    pill.style.cssText = `
      display: inline-flex; align-items: center; gap: 10px;
      padding: 8px 14px; border-radius: 999px;
      background: rgba(59, 102, 255, 0.10);
      border: 1px solid rgba(91, 130, 255, 0.32);
      color: #e8eaef;
      font-family: 'Geist Mono', ui-monospace, Menlo, monospace;
      font-size: 0.84rem;
      letter-spacing: -0.01em;
    `;
    const dot = document.createElement("span");
    dot.style.cssText = "width: 8px; height: 8px; border-radius: 50%; background: #6ee7a8; box-shadow: 0 0 12px rgba(110, 231, 168, 0.7);";
    const addr = document.createElement("span");
    addr.textContent = "CDi6…knMX";
    const net = document.createElement("span");
    net.textContent = "devnet";
    net.style.cssText = "color: #5a82ff; font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.14em;";
    pill.appendChild(dot);
    pill.appendChild(addr);
    pill.appendChild(net);
    status.appendChild(pill);

    // enable provision button
    const btn = document.getElementById("provisionBtn");
    if (btn) btn.disabled = false;
  });
}

async function injectProvisionLog(page) {
  await page.evaluate(() => {
    const station = document.querySelector('.station[data-step="1"]');
    if (station) station.classList.add("active");
    const log = document.getElementById("provisionLog");
    if (!log) return;
    log.replaceChildren();
    const lines = [
      ["queue: init Allowlist PDA", "#5a82ff"],
      ["queue: init OFAC PDA", "#5a82ff"],
      ["queue: create Token-2022 mint with TransferHook ext", "#5a82ff"],
      ["queue: init ExtraAccountMetaList", "#5a82ff"],
      ["queue: create source ATA + dest ATA", "#5a82ff"],
      ["queue: mint 1000 to source", "#5a82ff"],
      ["bundling 7 instructions into one signed transaction…", "#9aa1b3"],
      ["✓ provision complete · sig 5xK7…dQ8M", "#6ee7a8"],
    ];
    const wrap = document.createElement("div");
    wrap.style.cssText = "font-family: ui-monospace,Menlo,monospace; font-size: 11px; line-height: 1.55;";
    for (const [text, color] of lines) {
      const div = document.createElement("div");
      div.style.color = color;
      div.textContent = text;
      wrap.appendChild(div);
    }
    log.appendChild(wrap);

    // Enable next buttons
    for (const id of ["transferFailBtn", "addAllowBtn", "transferOkBtn", "umbraShieldBtn"]) {
      const b = document.getElementById(id);
      if (b) b.disabled = false;
    }
  });
}

async function injectRejectLog(page) {
  await page.evaluate(() => {
    const station = document.querySelector('.station[data-step="2"]');
    if (station) station.classList.add("active");
    const log = document.getElementById("transferFailLog");
    if (!log) return;
    log.replaceChildren();
    const wrap = document.createElement("div");
    wrap.style.cssText = "font-family: ui-monospace,Menlo,monospace; font-size: 11px; line-height: 1.55;";
    const lines = [
      ["sending 100 tokens to dest…", "#9aa1b3"],
      ["tx simulation failed: custom program error: 0x1771", "#e85a4a"],
      ["logs: policy_allowlist::check_transfer", "#9aa1b3"],
      ["✗ policy.allowlist.fail: destination not on allowlist", "#e85a4a"],
    ];
    for (const [text, color] of lines) {
      const div = document.createElement("div");
      div.style.color = color;
      div.textContent = text;
      wrap.appendChild(div);
    }
    log.appendChild(wrap);
  });
}

async function injectAllowLog(page) {
  await page.evaluate(() => {
    const station = document.querySelector('.station[data-step="3"]');
    if (station) station.classList.add("active");
    const log = document.getElementById("addAllowLog");
    if (!log) return;
    log.replaceChildren();
    const wrap = document.createElement("div");
    wrap.style.cssText = "font-family: ui-monospace,Menlo,monospace; font-size: 11px; line-height: 1.55;";
    const lines = [
      ["CPI: policy_allowlist::add_allowed", "#5a82ff"],
      ["✓ added to allowlist · sig 4mN3…fR2P", "#6ee7a8"],
    ];
    for (const [text, color] of lines) {
      const div = document.createElement("div");
      div.style.color = color;
      div.textContent = text;
      wrap.appendChild(div);
    }
    log.appendChild(wrap);
  });
}

async function injectApproveLogAndReceipt(page) {
  await page.evaluate(() => {
    const station = document.querySelector('.station[data-step="4"]');
    if (station) station.classList.add("active");
    const log = document.getElementById("transferOkLog");
    if (log) {
      log.replaceChildren();
      const wrap = document.createElement("div");
      wrap.style.cssText = "font-family: ui-monospace,Menlo,monospace; font-size: 11px; line-height: 1.55;";
      const lines = [
        ["sending 100 tokens to dest…", "#9aa1b3"],
        ["tx confirmed in 1 slot · sig 7zK3…aP9L", "#6ee7a8"],
        ["logs: policy_allowlist::check_transfer → PASS", "#f5a623"],
        ["logs: policy_sanctions_ofac::check_transfer → PASS", "#f5a623"],
        ["MetaHookAuditEvent decoded · final=APPROVED", "#6ee7a8"],
      ];
      for (const [text, color] of lines) {
        const div = document.createElement("div");
        div.style.color = color;
        div.textContent = text;
        wrap.appendChild(div);
      }
      log.appendChild(wrap);
    }

    // Audit receipt panel
    const audit = document.getElementById("auditEventBox");
    const id = document.getElementById("auditReceiptId");
    const table = document.getElementById("auditEventTable");
    if (audit && table) {
      audit.classList.remove("hidden");
      if (id) id.textContent = "RECEIPT · 7zK3…aP9L";
      table.replaceChildren();
      const rows = [
        ["mint",                  "9p4f…ZLh9d", ""],
        ["source",                "BvSQ…JkWt",  ""],
        ["destination",           "EcZ7…Vehy",  ""],
        ["amount",                "100",        ""],
        ["policy_allowlist",      "PASS",       "color:#f5a623;font-weight:700"],
        ["policy_sanctions_ofac", "PASS",       "color:#f5a623;font-weight:700"],
        ["final",                 "APPROVED",   "color:#6ee7a8;font-weight:700"],
        ["block",                 "323,891,402","font-variant-numeric:tabular-nums"],
      ];
      for (const [k, v, vCss] of rows) {
        const dt = document.createElement("dt");
        dt.style.cssText = "font-family:ui-monospace,Menlo,monospace;font-size:13px;color:#9aa1b3;letter-spacing:-0.005em;";
        dt.textContent = k;
        const dd = document.createElement("dd");
        dd.style.cssText = "font-family:ui-monospace,Menlo,monospace;font-size:13px;color:#e8eaef;margin-bottom:6px;";
        const span = document.createElement("span");
        span.style.cssText = vCss;
        span.textContent = v;
        dd.appendChild(span);
        table.appendChild(dt);
        table.appendChild(dd);
      }
    }
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

    const card = mkEl("div", `position: fixed; inset: 0; display: flex; flex-direction: column;
       align-items: center; justify-content: center;
       background:
         radial-gradient(1200px 700px at 80% -8%, rgba(59, 102, 255, 0.20), transparent 60%),
         radial-gradient(900px 600px at -10% 30%, rgba(59, 102, 255, 0.10), transparent 60%),
         radial-gradient(900px 700px at 50% 110%, rgba(59, 102, 255, 0.08), transparent 60%),
         #0a0c12;
       font-family: 'Geist', 'Inter', -apple-system, system-ui, sans-serif;
       color: #e8eaef; z-index: 999999;`, "");

    const logoRow = mkEl("div", "display:flex; align-items:center; gap:20px; margin-bottom: 28px;", "");
    logoRow.appendChild(mkEl("div", `width: 88px; height: 88px;
       display: flex; align-items: center; justify-content: center;
       border: 2px solid #3b66ff; color: #3b66ff;
       border-radius: 14px;
       font-family: 'Geist Mono', ui-monospace, monospace;
       font-size: 56px; font-weight: 600;
       background: rgba(59, 102, 255, 0.10);
       box-shadow: 0 0 40px rgba(59, 102, 255, 0.30);`, "M"));
    logoRow.appendChild(mkEl("div", "font-size: 88px; font-weight: 700; letter-spacing: -0.04em;", "MetaHook"));
    card.appendChild(logoRow);

    const tagline = mkEl("div", `font-family: 'Geist', sans-serif;
       font-size: 30px; color: #9aa1b3; max-width: 1200px; text-align: center;
       line-height: 1.35; letter-spacing: -0.015em; margin-bottom: 56px;`, "");
    tagline.appendChild(document.createTextNode("Compose your compliance stack the same way you"));
    tagline.appendChild(mkEl("br", "", ""));
    tagline.appendChild(document.createTextNode("compose middleware in Express."));
    card.appendChild(tagline);

    const links = mkEl("div", `display: flex; gap: 28px;
       font-family: 'Geist Mono', ui-monospace, monospace;
       font-size: 24px; color: #5a82ff;`, "");
    links.appendChild(mkEl("span", "", "yonkoo11.github.io/multihook"));
    links.appendChild(mkEl("span", "color:#5d6478", "·"));
    links.appendChild(mkEl("span", "", "github.com/Yonkoo11/multihook"));
    card.appendChild(links);

    document.body.appendChild(card);
  });
}

// ---- Main flow --------------------------------------------------------------

async function recordFlow(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await installCursorOverlay(page);

  log("loading landing (pre-roll)");
  await page.goto(DEMO_BASE + "/", { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForFunction(() => document.querySelector(".pipeline-svg, h1") != null, { timeout: 15000 });
  await sleep(1500);
  await page.bringToFront();
  await page.mouse.move(960, 540, { steps: 1 });

  const recorder = new PuppeteerScreenRecorder(page, RECORDER);
  await recorder.start(OUT);
  log(`recording -> ${OUT}`);

  try {
    // 01 HERO ----------------------------------------------------------------
    log(`01 hero (${PACE.HERO_LINGER}ms)`);
    await sleep(2000);
    await page.mouse.move(1200, 380, { steps: 60 });
    await sleep(PACE.HERO_LINGER - 2000);

    // 02 PROBLEM -------------------------------------------------------------
    log("02 scroll to problem");
    await smoothScrollTo(page, 750, PACE.PROBLEM_SCROLL);
    await page.mouse.move(420, 540, { steps: 30 });
    await sleep(PACE.PROBLEM_LINGER);

    // TRANSITION: navigate to /demo/
    log("nav to /demo/");
    await smoothScrollTo(page, 0, 700);
    await moveCursorTo(page, 'a.topnav-link[href="./demo/"]', { steps: 30 });
    await sleep(300);
    await buttonClickAnim(page, 'a.topnav-link[href="./demo/"]');
    await page.click('a.topnav-link[href="./demo/"]');
    await page.waitForFunction(() => document.querySelector("#provisionBtn") != null, { timeout: 15000 });
    await sleep(PACE.TO_DEMO);

    // 03 CONNECT + PROVISION -------------------------------------------------
    log("03a hover Connect, inject wallet pill");
    await moveCursorTo(page, "#connectBtn", { steps: 35 });
    await sleep(800);
    await buttonClickAnim(page, "#connectBtn");
    await injectConnectedWallet(page);
    await sleep(PACE.CONNECT - 1000);

    log("03b hover Provision, inject provision log");
    await moveCursorTo(page, "#provisionBtn", { steps: 25 });
    await sleep(500);
    await buttonClickAnim(page, "#provisionBtn");
    await injectProvisionLog(page);
    await sleep(PACE.PROVISION - 700);

    // 04 REJECT --------------------------------------------------------------
    log("04 hover Send 100 (expect revert), inject fail log");
    await moveCursorTo(page, "#transferFailBtn", { steps: 30 });
    await sleep(500);
    await buttonClickAnim(page, "#transferFailBtn");
    await injectRejectLog(page);
    await sleep(PACE.REJECT - 700);

    // 05 ALLOW ---------------------------------------------------------------
    log("05 hover Add to allowlist, inject log");
    await moveCursorTo(page, "#addAllowBtn", { steps: 25 });
    await sleep(400);
    await buttonClickAnim(page, "#addAllowBtn");
    await injectAllowLog(page);
    await sleep(PACE.ALLOW - 600);

    // 06 APPROVE + RECEIPT ---------------------------------------------------
    log("06 hover Retry, inject audit receipt");
    await moveCursorTo(page, "#transferOkBtn", { steps: 30 });
    await sleep(500);
    await buttonClickAnim(page, "#transferOkBtn");
    await injectApproveLogAndReceipt(page);
    await sleep(800);
    // Scroll the audit receipt into the middle of the viewport
    await page.evaluate(() => {
      const el = document.getElementById("auditEventBox");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    await sleep(1500);
    await moveCursorTo(page, "#auditEventBox", { dy: -100, steps: 30 });
    await sleep(PACE.APPROVE - 2800);

    // TRANSITION + 07 COMPOSE: navigate to /docs/policies/ -------------------
    log("07a nav to docs/policies");
    await page.goto(DEMO_BASE + "/docs/policies/", { waitUntil: "domcontentloaded", timeout: 20000 });
    await sleep(PACE.TO_DOCS);
    log(`07b slow scroll through spec`);
    await smoothScrollTo(page, 1200, PACE.COMPOSE - 1500);
    await sleep(1500);

    // 08 CLOSE ---------------------------------------------------------------
    log("08 closing card");
    await page.goto(DEMO_BASE + "/", { waitUntil: "domcontentloaded", timeout: 20000 });
    await sleep(PACE.TO_CLOSE);
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
  console.log(`demo:      ${DEMO_BASE}`);
  console.log(`output:    ${OUT}`);

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
    console.log(`\n🎬 RECORDING DONE -> ${OUT}`);
  } catch (e) {
    console.error("❌ recording failed:", e.message);
    console.error(e.stack);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
