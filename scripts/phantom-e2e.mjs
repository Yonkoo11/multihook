/**
 * Real-Phantom end-to-end test for the multihook demo on devnet.
 *
 * Boots Chrome with the Phantom extension loaded and a persistent profile so
 * onboarding is done once and reused. Drives:
 *   1. Phantom onboarding (Import Private Key flow) on first run
 *   2. Switch to devnet
 *   3. Connect Phantom on the live demo URL (or local dev URL)
 *   4. Provision -> expect-fail transfer -> add to allowlist -> retry success
 *   5. Verify MetaHookAuditEvent rendered in the UI
 *
 * Selectors are intentionally text-based (waitForFunction over textContent)
 * because Phantom's React class names are minified and change between releases.
 *
 * Inputs (env or defaults):
 *   PHANTOM_KEY_FILE  - path to base58 private-key file  [/tmp/phantom-test-key.b58]
 *   DEMO_URL          - URL of the multihook demo       [https://yonkoo11.github.io/multihook/]
 *   PROFILE_DIR       - persistent Chrome profile dir   [/tmp/multihook-phantom-profile]
 *   EXT_DIR           - unpacked Phantom extension      [/tmp/phantom-crx/unpacked]
 *   CHROME_BIN        - chrome-for-testing executable   [auto from ~/.cache/puppeteer/]
 *
 * Screenshots are written to scripts/screens/ — one per major step.
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const PHANTOM_ID = "bfnaelmomeimhlpmgjnjophhpkkoljpa";
const PHANTOM_KEY_FILE = process.env.PHANTOM_KEY_FILE ?? "/tmp/phantom-test-key.b58";
const DEMO_URL = process.env.DEMO_URL ?? "https://yonkoo11.github.io/multihook/demo/";
const PROFILE_DIR = process.env.PROFILE_DIR ?? "/tmp/multihook-phantom-profile";
const EXT_DIR = process.env.EXT_DIR ?? "/tmp/phantom-crx/unpacked";
const PHANTOM_PASSWORD = process.env.PHANTOM_PASSWORD ?? "PhantomTest!2026Demo";
const SCREENS_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), "screens");

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

function privKey() {
  return fs.readFileSync(PHANTOM_KEY_FILE, "utf8").trim();
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

let stepCounter = 0;
async function snap(page, name) {
  ensureDir(SCREENS_DIR);
  const file = path.join(SCREENS_DIR, `${String(++stepCounter).padStart(2, "0")}-${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: false });
    console.log(`  📸 ${path.basename(file)}`);
  } catch (e) {
    console.warn(`  (screenshot failed: ${e.message})`);
  }
}

function log(msg) {
  console.log(`\n▶ ${msg}`);
}

/**
 * Wait for any element matching a text predicate to be visible. Returns the
 * element handle. Polls on the page so React renders settle naturally.
 */
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
    text,
    exact,
    requireEnabled
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
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw lastErr ?? new Error(`button "${text}" never became enabled`);
}

/**
 * Returns true if the Phantom extension already has a wallet (post-onboarding
 * lock screen with password input).
 */
async function isPhantomOnboarded(popup) {
  try {
    await popup.waitForFunction(
      () => {
        const text = document.body?.innerText?.toLowerCase() ?? "";
        // Lock screen wording vs onboarding wording
        return text.includes("unlock") || text.includes("welcome back") ||
               text.includes("get started") || text.includes("create a new wallet") ||
               text.includes("i already have a wallet");
      },
      { timeout: 15000 }
    );
  } catch {
    return null;
  }
  return await popup.evaluate(() => {
    const t = document.body.innerText.toLowerCase();
    return t.includes("unlock") || t.includes("welcome back");
  });
}

async function openPhantomPopup(browser) {
  const popup = await browser.newPage();
  await popup.setViewport({ width: 380, height: 600 });
  await popup.goto(`chrome-extension://${PHANTOM_ID}/popup.html`, { waitUntil: "domcontentloaded" });
  return popup;
}

/**
 * On fresh install, Phantom opens its onboarding in a separate tab (an
 * onboarding.html or popup.html targeted at full-page mode). Find that page
 * if it exists, otherwise fall back to opening the popup ourselves.
 */
async function findOrOpenPhantomOnboardingPage(browser) {
  // Wait up to 8s for Phantom's auto-opened onboarding tab
  const start = Date.now();
  while (Date.now() - start < 8000) {
    const pages = await browser.pages();
    const phantomPage = pages.find((p) => p.url().startsWith(`chrome-extension://${PHANTOM_ID}/`));
    if (phantomPage) return phantomPage;
    await new Promise((r) => setTimeout(r, 250));
  }
  // None auto-opened — open one manually
  return openPhantomPopup(browser);
}

async function onboardPhantom(browser) {
  log("opening Phantom popup");
  const popup = await findOrOpenPhantomOnboardingPage(browser);
  console.log(`  using phantom page: ${popup.url()}`);
  await new Promise((r) => setTimeout(r, 1500));
  await snap(popup, "phantom-fresh");

  const onboarded = await isPhantomOnboarded(popup);
  if (onboarded) {
    log("Phantom already onboarded — unlocking");
    await popup.type('input[type="password"]', PHANTOM_PASSWORD, { delay: 30 });
    await snap(popup, "phantom-unlock");
    await clickText(popup, "Unlock");
    // Wait for main wallet UI
    await popup.waitForFunction(() => {
      const t = document.body.innerText.toLowerCase();
      return t.includes("send") || t.includes("receive") || t.includes("swap");
    }, { timeout: 20000 });
    await snap(popup, "phantom-unlocked");
    await popup.close();
    return;
  }

  log("walking onboarding (Import Private Key)");
  // Welcome screen
  await clickText(popup, "I already have a wallet");
  await snap(popup, "onboard-already-have");

  // "Import Private Key" option
  await clickText(popup, "Import Private Key");
  await snap(popup, "onboard-import-pk-screen");

  // The screen shows: Solana dropdown (default), Name input, private-key textarea, Import button.
  await popup.waitForSelector("textarea", { timeout: 15000 });

  // Fill the wallet name (Import button disabled without it)
  const nameInput = await popup.$('input[placeholder*="ame" i], input[type="text"]');
  if (!nameInput) throw new Error("could not find name input");
  await nameInput.click({ clickCount: 3 });
  await nameInput.type("Multihook Test", { delay: 25 });

  // Paste private key — Phantom uses a textarea here
  const pasted = await popup.evaluate((sk) => {
    const ta = document.querySelector("textarea");
    if (!ta) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(ta, sk);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, privKey());
  if (!pasted) throw new Error("could not find private-key textarea");
  await new Promise((r) => setTimeout(r, 500));
  await snap(popup, "onboard-pk-filled");

  // Click Import (now enabled)
  await clickText(popup, "Import");
  await snap(popup, "onboard-after-import");

  // Set password
  await popup.waitForFunction(() => {
    const inputs = Array.from(document.querySelectorAll('input[type="password"]'));
    return inputs.length >= 2;
  }, { timeout: 30000 });
  const pwInputs = await popup.$$('input[type="password"]');
  await pwInputs[0].type(PHANTOM_PASSWORD, { delay: 25 });
  await pwInputs[1].type(PHANTOM_PASSWORD, { delay: 25 });
  // Tick the T&C if present
  await popup.evaluate(() => {
    const cb = document.querySelector('input[type="checkbox"]');
    if (cb && !cb.checked) cb.click();
  });
  await snap(popup, "onboard-password");
  await clickText(popup, "Continue");

  // Final "Get Started" or "Finish"
  try {
    await waitForText(popup, "Get Started", { timeout: 30000 });
    await clickText(popup, "Get Started");
  } catch {
    // some flows skip this
  }
  await snap(popup, "onboard-done");
  await popup.close();
}

async function switchToDevnet(browser) {
  log("switching Phantom to devnet");
  const popup = await openPhantomPopup(browser);
  await new Promise((r) => setTimeout(r, 1500));
  await snap(popup, "devnet-home");

  // Click the avatar (top-left "M" button) to open the wallet menu
  const avatarClicked = await popup.evaluate(() => {
    const all = Array.from(document.querySelectorAll('button, [role="button"], div'));
    const headerCandidates = all.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.top < 60 && r.left < 80 && r.width > 0 && r.height > 0 && el.offsetParent;
    });
    // The avatar is typically the first button/div in the header
    if (headerCandidates[0]) {
      headerCandidates[0].click();
      return true;
    }
    return false;
  });
  if (!avatarClicked) throw new Error("could not click avatar");
  await new Promise((r) => setTimeout(r, 800));
  await snap(popup, "devnet-after-avatar");

  // From the side menu, find "Settings"
  try {
    await clickText(popup, "Settings", { timeout: 8000 });
  } catch {
    // Some Phantom versions land on a wallet-menu sheet instead. Look for a gear icon.
    await popup.evaluate(() => {
      const svgs = Array.from(document.querySelectorAll("svg"));
      const gear = svgs.find((s) => {
        const aria = s.getAttribute("aria-label")?.toLowerCase() ?? "";
        return aria.includes("setting") || s.outerHTML.toLowerCase().includes("settings");
      });
      gear?.closest("button, a, [role='button']")?.click();
    });
  }
  await new Promise((r) => setTimeout(r, 600));
  await snap(popup, "devnet-settings");

  // "Developer Settings"
  await clickText(popup, "Developer Settings", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 600));
  await snap(popup, "devnet-developer-settings");

  // Toggle "Testnet Mode" ON if not already
  await popup.evaluate(() => {
    const labels = Array.from(document.querySelectorAll("div, label, span"));
    const row = labels.find((el) => /testnet mode/i.test(el.textContent ?? "") && el.offsetParent);
    if (!row) return;
    // The toggle is the nearest button/checkbox to this row
    const container = row.closest("div");
    const toggle = container?.querySelector('button[role="switch"], input[type="checkbox"]');
    const isOn = toggle?.getAttribute("aria-checked") === "true" || (toggle && toggle.checked);
    if (toggle && !isOn) toggle.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await snap(popup, "devnet-testnet-on");

  await popup.close();
  log("devnet switch attempted (Testnet Mode toggled)");
}

/**
 * Wait for a NEW Phantom popup window to open in response to a dApp action.
 * Tracks already-seen popup target IDs so the same popup is never returned
 * twice across calls.
 */
const _seenPopupTargets = new Set();

async function waitForPhantomPopup(browser, { timeout = 25000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const targets = browser.targets();
    const phantomTarget = targets.find((t) => {
      const url = t.url();
      const id = t._targetId ?? url; // _targetId is private but stable; fallback to url
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
        // garbage-collect stale ids when their pages close
        popup.on("close", () => _seenPopupTargets.delete(id));
        return popup;
      }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

async function approvePopup(browser, { label, approvalText = "Approve", timeout = 25000 } = {}) {
  log(`waiting for Phantom popup [${label}]`);
  const popup = await waitForPhantomPopup(browser, { timeout });
  if (!popup) throw new Error(`Phantom popup [${label}] never opened`);
  // Phantom shows "Click this dialog to continue" until a real user gesture
  // arrives. Bring popup to front + use page.mouse.click (CDP input events,
  // which Chrome treats as trusted), then poll for the lock screen to clear.
  await popup.bringToFront();
  await new Promise((r) => setTimeout(r, 400));
  const vp = popup.viewport() ?? { width: 380, height: 600 };
  // click in the lower-center area to avoid header chrome
  await popup.mouse.click(vp.width / 2, vp.height / 2);
  await new Promise((r) => setTimeout(r, 400));
  // Wait for the lock-screen text to disappear
  for (let i = 0; i < 12; i++) {
    const locked = await popup.evaluate(() => {
      const t = (document.body?.innerText ?? "").toLowerCase();
      return t.includes("click this dialog");
    });
    if (!locked) break;
    await popup.mouse.click(vp.width / 2, vp.height / 2);
    await new Promise((r) => setTimeout(r, 500));
  }
  await snap(popup, `popup-${label}`);

  // Phantom drainer-protection: if it shows "Request blocked", click "Proceed
  // anyway" first, then retry the approval label.
  const blocked = await popup.evaluate(() => (document.body?.innerText ?? "").toLowerCase().includes("request blocked"));
  if (blocked) {
    console.log(`  Phantom flagged dApp as malicious (drainer-pattern detection); proceeding anyway`);
    await clickText(popup, "Proceed anyway", { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 1500));
    await snap(popup, `popup-${label}-after-proceed`);
  }

  const tries = [approvalText, "Confirm", "Connect", "Approve"];
  let ok = false;
  for (const t of tries) {
    try {
      await clickWhenEnabled(popup, t, { timeout: 20000 });
      ok = true;
      console.log(`  approved with "${t}"`);
      break;
    } catch {
      // try the next label
    }
  }
  if (!ok) throw new Error(`no enabled approval button found in [${label}] popup`);
  await snap(popup, `popup-${label}-approved`);
  await new Promise((r) => setTimeout(r, 1000));
}

async function runDemo(browser) {
  log(`opening demo: ${DEMO_URL}`);
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(DEMO_URL, { waitUntil: "domcontentloaded" });
  await snap(page, "demo-loaded");

  // Connect — eager-connect (silent) or click + popup. The dApp may eager-
  // connect between waitForFunction and our click, detaching the button, so
  // wait extra to let either path settle, then re-check.
  log("connecting");
  await page.waitForFunction(
    () => document.querySelector(".wallet-pill") || document.getElementById("connectBtn"),
    { timeout: 10000 }
  );
  await new Promise((r) => setTimeout(r, 1500)); // let eager-connect race resolve
  let connected = await page.evaluate(() => !!document.querySelector(".wallet-pill"));
  if (connected) {
    log("wallet auto-connected (Phantom trusted dApp)");
  } else {
    log("clicking Connect Phantom + waiting for popup");
    const popupPromise = approvePopup(browser, { label: "connect", approvalText: "Connect" }).catch((e) => e);
    try {
      await page.click("#connectBtn");
    } catch (e) {
      // Button may have been replaced by a successful eager-connect just now
      console.log(`  (click race; checking state: ${e.message})`);
    }
    const popupResult = await popupPromise;
    if (popupResult instanceof Error) {
      // No popup arrived — wallet may have auto-connected in the meantime
      console.log(`  no popup (${popupResult.message}); checking wallet state…`);
    }
  }
  await page.waitForFunction(
    () => document.querySelector(".wallet-pill")?.textContent?.includes("devnet"),
    { timeout: 15000 }
  );
  // Wait for the provision button to become enabled (balance + state load)
  await page.waitForFunction(
    () => !document.getElementById("provisionBtn")?.disabled,
    { timeout: 30000 }
  );
  await snap(page, "demo-connected");

  // Reset demo state deterministically: nuke localStorage + reload, then
  // re-wait for connect/state.
  if (process.env.RESET_FIRST !== "0") {
    log("resetting demo state via localStorage clear + goto");
    await page.evaluate(() => {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("multihook:demo:")) localStorage.removeItem(k);
      });
    });
    // goto same URL is more reliable than reload() in this puppeteer build
    await page.goto(DEMO_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
    // After goto, the dApp eager-connects silently (already trusted). Just
    // wait for the wallet pill to appear without clicking anything.
    await page.waitForFunction(
      () => document.querySelector(".wallet-pill")?.textContent?.includes("devnet"),
      { timeout: 25000 }
    );
    await page.waitForFunction(
      () => !document.getElementById("provisionBtn")?.disabled,
      { timeout: 30000 }
    );
    await snap(page, "demo-after-reset");
  }

  // Provision: dApp sends 3-4 separate sendTransaction calls, but Phantom
  // batches simultaneous requests into a single "Confirm Transactions" popup.
  // We try to approve up to 6 popups but break early on completion.
  log("provisioning (Phantom batches into one popup)");
  // Subscribe to dApp console for diagnostic visibility
  page.on("console", (msg) => {
    const t = msg.type();
    if (t === "error" || t === "warning") console.log(`  [dApp:${t}] ${msg.text().slice(0, 220)}`);
  });
  await page.click("#provisionBtn");
  let popupCount = 0;
  while (popupCount < 6) {
    const status = await page.evaluate(() => ({
      log: (document.getElementById("provisionLog")?.textContent ?? "").slice(-300),
      btnLabel: document.getElementById("provisionBtn")?.textContent ?? "",
    }));
    if (status.log.includes("provision complete")) break;
    if (status.log.includes("provision failed")) throw new Error("provision failed in dApp before completion");
    try {
      await approvePopup(browser, { label: `provision-${++popupCount}`, approvalText: "Confirm", timeout: 25000 });
    } catch (e) {
      console.log(`  no popup yet (${e.message}); dApp log tail: …${status.log.slice(-180)}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  await page.waitForFunction(
    () => (document.getElementById("provisionLog")?.textContent ?? "").includes("provision complete"),
    { timeout: 60000 }
  );
  await snap(page, "demo-provisioned");

  // Step 2: try transfer (will fail) — single popup. The user must still
  // sign + send the tx; the policy check runs on-chain and the tx fails there.
  log("transfer expect fail");
  await page.click("#transferFailBtn");
  await approvePopup(browser, { label: "fail-transfer", approvalText: "Confirm" });
  await page.waitForFunction(() => {
    const t = document.getElementById("transferFailLog")?.textContent ?? "";
    return t.includes("policy.allowlist.fail");
  }, { timeout: 30000 });
  await snap(page, "demo-fail-confirmed");

  // Step 3: add to allowlist
  log("add to allowlist");
  await page.click("#addAllowBtn");
  await approvePopup(browser, { label: "add-allow", approvalText: "Confirm" });
  await page.waitForFunction(() => document.getElementById("addAllowLog")?.textContent?.includes("added to allowlist"), { timeout: 30000 });
  await snap(page, "demo-allowlisted");

  // Step 4: retry success
  log("retry expect success + audit event");
  await page.click("#transferOkBtn");
  await approvePopup(browser, { label: "ok-transfer", approvalText: "Confirm" });
  await page.waitForFunction(() => {
    const t = document.getElementById("transferOkLog")?.textContent ?? "";
    return t.includes("MetaHookAuditEvent decoded");
  }, { timeout: 45000 });
  await snap(page, "demo-success");

  // Verify audit event box is visible + decoded fields rendered
  const audit = await page.evaluate(() => {
    const visible = !document.getElementById("auditEventBox")?.classList.contains("hidden");
    const body = document.getElementById("auditEventTable")?.textContent ?? "";
    return { visible, body };
  });
  console.log("\n✅ AUDIT EVENT:", audit.body.slice(0, 300));
  if (!audit.visible) throw new Error("audit event box not visible after success");
  if (!/APPROVE/.test(audit.body)) throw new Error("audit event missing APPROVE verdict");
  await snap(page, "demo-final");
}

async function main() {
  ensureDir(PROFILE_DIR);
  ensureDir(SCREENS_DIR);
  if (!fs.existsSync(PHANTOM_KEY_FILE)) throw new Error(`missing ${PHANTOM_KEY_FILE}`);
  if (!fs.existsSync(EXT_DIR)) throw new Error(`missing ${EXT_DIR} (extract Phantom CRX first)`);

  const chrome = findChrome();
  console.log(`chrome: ${chrome}`);
  console.log(`profile: ${PROFILE_DIR}`);
  console.log(`extension: ${EXT_DIR}`);
  console.log(`demo: ${DEMO_URL}`);

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
      "--disable-features=DialMediaRouteProvider",
    ],
  });

  // Wait for Phantom service worker to register
  await new Promise((r) => setTimeout(r, 2000));

  try {
    await onboardPhantom(browser);
    if (process.env.ONBOARD_ONLY === "1") {
      console.log("\n✅ Phantom onboarded — exiting (ONBOARD_ONLY=1)");
      await browser.close();
      process.exit(0);
    }
    // Skip explicit devnet switch — Phantom signs whatever the dApp's RPC
    // gives it; the "network" toggle is just a UI affordance for showing
    // balances. Our dApp connects to devnet directly.
    if (process.env.SWITCH_DEVNET === "1") await switchToDevnet(browser);
    await runDemo(browser);
    console.log("\n🎉 PHANTOM E2E PASSED");
  } catch (e) {
    console.error("\n❌ PHANTOM E2E FAILED:", e.message);
    console.error(e.stack);
    process.exitCode = 1;
  } finally {
    // leave browser open for inspection; comment out to auto-close
    // await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
