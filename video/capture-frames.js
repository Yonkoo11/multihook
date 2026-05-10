#!/usr/bin/env node
// Capture demo video frames from live MetaHook site.
// Seven distinct visuals — no repeated viewports per the
// feedback_demo_video_distinct_frames lesson.
//
// Frames 04 (REJECT) and 05 (APPROVE) need state that only exists
// after a real Phantom-signed transfer fires. We inject the post-
// transfer DOM state directly so the demo viewport matches what a
// judge would actually see at that step.
//
// Usage: node video/capture-frames.js [base-url]
//        defaults to https://yonkoo11.github.io/multihook

const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const BASE = (process.argv[2] || "https://yonkoo11.github.io/multihook").replace(/\/$/, "");
const FRAMES_DIR = path.join(__dirname, "frames");
const W = 1920;
const H = 1080;

fs.mkdirSync(FRAMES_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// State injectors — populate the demo page DOM with the visual state that
// would only exist after a real Phantom-signed transfer. All content below
// is hard-coded (no user input flows in), constructed via DOM APIs so we
// never touch innerHTML.
// ---------------------------------------------------------------------------

async function injectRejectState(page) {
  await page.evaluate(() => {
    const mkEl = (tag, css, text) => {
      const el = document.createElement(tag);
      if (css) el.style.cssText = css;
      if (text != null) el.textContent = text;
      return el;
    };
    const mono = "font-family: ui-monospace,Menlo,monospace; font-size: 12px;";

    const station = document.querySelector('.station[data-step="2"]');
    if (station) {
      station.classList.add("active");
      const log = station.querySelector("#transferFailLog");
      if (log) {
        log.replaceChildren();
        const wrap = mkEl("div", mono + " color: #e85a4a;");
        wrap.appendChild(mkEl("div", "", "tx simulation failed: custom program error: 0x1771"));
        const line = mkEl("div", "");
        line.appendChild(mkEl("span", "color:#9aa1b3", "logs: policy_allowlist::check_transfer "));
        line.appendChild(mkEl("span", "", "returned "));
        const reason = mkEl("strong", "color:#e85a4a", "policy.allowlist.fail: destination not on allowlist");
        line.appendChild(reason);
        wrap.appendChild(line);
        log.appendChild(wrap);
      }
    }

    const feed = document.getElementById("auditFeedBox");
    const list = document.getElementById("auditFeedList");
    if (feed && list) {
      feed.classList.remove("hidden");
      list.replaceChildren();
      const li = mkEl("li", "", "");
      li.className = "audit-feed-entry audit-feed-rejected";
      const cells = [
        ["audit-feed-time", "just now"],
        ["audit-feed-status", "REJECTED"],
        ["audit-feed-reason", "policy.allowlist.fail"],
        ["audit-feed-amount", "100 tokens"],
      ];
      for (const [cls, text] of cells) {
        const span = mkEl("span", "", text);
        span.className = cls;
        li.appendChild(span);
      }
      list.appendChild(li);
      const empty = document.getElementById("auditFeedEmpty");
      if (empty) empty.classList.add("hidden");
    }
  });
}

async function injectApproveState(page) {
  await page.evaluate(() => {
    const mkEl = (tag, css, text) => {
      const el = document.createElement(tag);
      if (css) el.style.cssText = css;
      if (text != null) el.textContent = text;
      return el;
    };
    const mono = "font-family: ui-monospace,Menlo,monospace; font-size: 12px;";

    const station = document.querySelector('.station[data-step="4"]');
    if (station) {
      station.classList.add("active");
      const log = station.querySelector("#transferOkLog");
      if (log) {
        log.replaceChildren();
        const wrap = mkEl("div", mono + " color: #6ee7a8;");

        const line1 = mkEl("div", "", "");
        line1.appendChild(mkEl("span", "", "tx confirmed in 1 slot · sig "));
        line1.appendChild(mkEl("span", "color:#5a82ff", "5xK7…dQ8M"));
        wrap.appendChild(line1);

        const lines = [
          ["policy_allowlist::check_transfer → ", "PASS"],
          ["policy_sanctions_ofac::check_transfer → ", "PASS"],
        ];
        for (const [label, verdict] of lines) {
          const line = mkEl("div", "", "");
          line.appendChild(mkEl("span", "color:#9aa1b3", "logs: " + label));
          line.appendChild(mkEl("strong", "color:#f5a623", verdict));
          wrap.appendChild(line);
        }

        log.appendChild(wrap);
      }
    }

    // Audit receipt detail block
    const audit = document.getElementById("auditEventBox");
    const receipt = document.getElementById("auditReceiptId");
    const table = document.getElementById("auditEventTable");
    if (audit && table) {
      audit.classList.remove("hidden");
      if (receipt) receipt.textContent = "RECEIPT · 5xK7…dQ8M";
      table.replaceChildren();
      const rows = [
        ["mint",                  ["span", "9p4f…ZLh9"]],
        ["source",                ["span", "BvSQ…JkWt"]],
        ["destination",           ["span", "EcZ7…Vehy"]],
        ["amount",                ["span", "100"]],
        ["policy_allowlist",      ["strong", "PASS", "color:#f5a623"]],
        ["policy_sanctions_ofac", ["strong", "PASS", "color:#f5a623"]],
        ["final",                 ["strong", "APPROVED", "color:#6ee7a8"]],
        ["block",                 ["span", "323,891,402"]],
      ];
      for (const [k, [tag, text, extra]] of rows) {
        const dt = mkEl("dt", "font-family:ui-monospace,Menlo,monospace;font-size:13px;color:#9aa1b3;", k);
        const dd = mkEl("dd", "font-family:ui-monospace,Menlo,monospace;font-size:13px;color:#e8eaef;margin-bottom:6px;");
        dd.appendChild(mkEl(tag, extra || "", text));
        table.appendChild(dt);
        table.appendChild(dd);
      }
    }

    // Audit feed gets the approved entry on top
    const feed = document.getElementById("auditFeedBox");
    const list = document.getElementById("auditFeedList");
    if (feed && list) {
      feed.classList.remove("hidden");
      list.replaceChildren();
      const entries = [
        {
          cls: "audit-feed-entry audit-feed-approved",
          cells: [
            ["audit-feed-time",   "just now"],
            ["audit-feed-status", "APPROVED", "color:#6ee7a8"],
            ["audit-feed-reason", "2/2 policies passed · audit event emitted"],
            ["audit-feed-amount", "100 tokens"],
          ],
        },
        {
          cls: "audit-feed-entry audit-feed-rejected",
          cells: [
            ["audit-feed-time",   "a moment ago"],
            ["audit-feed-status", "REJECTED"],
            ["audit-feed-reason", "policy.allowlist.fail"],
            ["audit-feed-amount", "100 tokens"],
          ],
        },
      ];
      for (const e of entries) {
        const li = mkEl("li", "", "");
        li.className = e.cls;
        for (const [cls, text, extra] of e.cells) {
          const span = mkEl("span", extra || "", text);
          span.className = cls;
          li.appendChild(span);
        }
        list.appendChild(li);
      }
      const empty = document.getElementById("auditFeedEmpty");
      if (empty) empty.classList.add("hidden");
    }
  });
}

// ---------------------------------------------------------------------------
// Closing card — branded overlay matching site palette + typography.
// ---------------------------------------------------------------------------
async function renderClosingCard(page) {
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
       font-family: "Geist", "Inter", -apple-system, system-ui, sans-serif;
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
  await new Promise((r) => setTimeout(r, 600));
}

// ---------------------------------------------------------------------------
// Section spec — one entry per clip.
// ---------------------------------------------------------------------------
const SECTIONS = [
  { name: "01-hero",     url: BASE + "/",         scrollTo: 0,    waitMs: 1500 },
  { name: "02-problem",  url: BASE + "/",         scrollTo: 750,  waitMs: 800  },
  { name: "03-solution", url: BASE + "/demo/",    scrollTo: 0,    waitMs: 1500 },
  { name: "04-reject",   url: BASE + "/demo/",    scrollTo: 320,  waitMs: 600,  inject: injectRejectState },
  { name: "05-approve",  url: BASE + "/demo/",    scrollTo: 320,  waitMs: 600,  inject: injectApproveState, afterInjectScroll: 720 },
  { name: "06-sponsors", url: BASE + "/sponsors/", scrollTo: 0,   waitMs: 1500 },
  { name: "07-close",    url: BASE + "/",         scrollTo: 0,    waitMs: 600,  custom: renderClosingCard },
];

async function captureSection(browser, section) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

  await page.goto(section.url, { waitUntil: "networkidle2", timeout: 30000 });
  await page.evaluate(
    (y) => window.scrollTo({ top: y, left: 0, behavior: "instant" }),
    section.scrollTo
  );
  await new Promise((r) => setTimeout(r, section.waitMs));

  if (section.inject) {
    await section.inject(page);
    await new Promise((r) => setTimeout(r, 400));
    if (section.afterInjectScroll != null) {
      await page.evaluate(
        (y) => window.scrollTo({ top: y, left: 0, behavior: "instant" }),
        section.afterInjectScroll
      );
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  if (section.custom) await section.custom(page);

  const out = path.join(FRAMES_DIR, section.name + ".png");
  await page.screenshot({ path: out, type: "png" });
  await page.close();
  return out;
}

(async () => {
  console.log("Capturing frames from " + BASE);
  const browser = await puppeteer.launch({
    headless: "new",
    args: [`--window-size=${W},${H}`, "--no-sandbox"],
  });

  for (const s of SECTIONS) {
    process.stdout.write("  " + s.name + " ... ");
    try {
      const out = await captureSection(browser, s);
      console.log(out);
    } catch (e) {
      console.log("FAILED: " + e.message);
    }
  }

  await browser.close();
  console.log("Done. " + SECTIONS.length + " frames in " + FRAMES_DIR);
})();
