import "./polyfill";

import { Connection, PublicKey } from "@solana/web3.js";

import { maybeInstallTestProvider } from "./testProvider";
import { PhantomWallet, ensureMinBalance, getPhantomProvider } from "./wallet";
import {
  DEMO_RPC,
  METAHOOK_ID,
  POLICY_ALLOWLIST_ID,
  POLICY_SANCTIONS_ID,
  Programs,
  RPC_PROVIDER,
  buildPrograms,
} from "./programs";
import {
  DemoState,
  clearState,
  destKp,
  loadState,
  makeFreshState,
  mintKp,
  saveState,
} from "./state";
import {
  addDestinationToAllowlist,
  AuditEvent,
  provision,
  retryTransferExpectSuccess,
  signAuditReceipt,
  SignedReceipt,
  tryTransferExpectFail,
} from "./demo";
import { mountAnalytics } from "./analytics-render";
import { AuditFeedEntry, fetchAuditFeed } from "./audit-feed";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  SiwsSession,
  clearSession,
  issuerSignIn,
  loadSession,
} from "./siws";
// NOTE: umbra-shield is loaded dynamically inside onUmbraShield() — the
// Umbra SDK pulls in ~2 MB of MPC + Arcium + indexer client deps that
// would otherwise bloat the initial page load for a feature only ~10%
// of demo users will actually exercise.

interface UI {
  walletStatus: HTMLElement;
  connectBtn: HTMLButtonElement;
  provisionBtn: HTMLButtonElement;
  transferFailBtn: HTMLButtonElement;
  addAllowBtn: HTMLButtonElement;
  transferOkBtn: HTMLButtonElement;
  umbraShieldBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
  provisionLog: HTMLElement;
  transferFailLog: HTMLElement;
  addAllowLog: HTMLElement;
  transferOkLog: HTMLElement;
  umbraShieldLog: HTMLElement;
  auditEventBox: HTMLElement;
  auditEventTable: HTMLElement;
  auditReceiptId: HTMLElement;
  metahookLink: HTMLAnchorElement;
  allowlistLink: HTMLAnchorElement;
  sanctionsLink: HTMLAnchorElement;
  mintLink: HTMLAnchorElement;
  destLink: HTMLAnchorElement;
  steps: NodeListOf<HTMLElement>;
}

const ui: UI = {
  walletStatus: document.getElementById("walletStatus")!,
  connectBtn: document.getElementById("connectBtn") as HTMLButtonElement,
  provisionBtn: document.getElementById("provisionBtn") as HTMLButtonElement,
  transferFailBtn: document.getElementById("transferFailBtn") as HTMLButtonElement,
  addAllowBtn: document.getElementById("addAllowBtn") as HTMLButtonElement,
  transferOkBtn: document.getElementById("transferOkBtn") as HTMLButtonElement,
  umbraShieldBtn: document.getElementById("umbraShieldBtn") as HTMLButtonElement,
  resetBtn: document.getElementById("resetBtn") as HTMLButtonElement,
  provisionLog: document.getElementById("provisionLog")!,
  transferFailLog: document.getElementById("transferFailLog")!,
  addAllowLog: document.getElementById("addAllowLog")!,
  transferOkLog: document.getElementById("transferOkLog")!,
  umbraShieldLog: document.getElementById("umbraShieldLog")!,
  auditEventBox: document.getElementById("auditEventBox")!,
  auditEventTable: document.getElementById("auditEventTable")!,
  auditReceiptId: document.getElementById("auditReceiptId")!,
  metahookLink: document.getElementById("metahookLink") as HTMLAnchorElement,
  allowlistLink: document.getElementById("allowlistLink") as HTMLAnchorElement,
  sanctionsLink: document.getElementById("sanctionsLink") as HTMLAnchorElement,
  mintLink: document.getElementById("mintLink") as HTMLAnchorElement,
  destLink: document.getElementById("destLink") as HTMLAnchorElement,
  steps: document.querySelectorAll("[data-step]"),
};

let connection: Connection;
let wallet: PhantomWallet | null = null;
let programs: Programs | null = null;
let state: DemoState | null = null;
let siwsSession: SiwsSession | null = null;

/**
 * Safe-DOM logger. Builds nodes from text + optional link only — no innerHTML
 * for caller-supplied content. Avoids the XSS class entirely.
 */
function makeLogger(el: HTMLElement) {
  el.classList.add("show");
  return (msg: string, kind: string = "", link?: string) => {
    const line = document.createElement("div");
    if (kind) line.className = kind;
    line.appendChild(document.createTextNode(msg));
    if (link) {
      line.appendChild(document.createTextNode(" "));
      const a = document.createElement("a");
      a.href = link;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "↗";
      line.appendChild(a);
    }
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  };
}

function clearLog(el: HTMLElement) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function setBusy(btn: HTMLButtonElement, busy: boolean, busyLabel?: string) {
  if (busy) {
    btn.dataset.label ??= btn.textContent ?? "";
    while (btn.firstChild) btn.removeChild(btn.firstChild);
    const spinner = document.createElement("span");
    spinner.className = "spinner";
    btn.appendChild(spinner);
    btn.appendChild(document.createTextNode(busyLabel ?? "Working…"));
    btn.disabled = true;
  } else {
    if (btn.dataset.label !== undefined) {
      while (btn.firstChild) btn.removeChild(btn.firstChild);
      btn.textContent = btn.dataset.label;
    }
    btn.disabled = false;
  }
}

function activateStep(step: number) {
  ui.steps.forEach((el) => {
    el.classList.toggle("active", Number(el.dataset.step) === step);
  });
}

function explorerAddr(pk: string | PublicKey): string {
  const s = typeof pk === "string" ? pk : pk.toBase58();
  return `https://solscan.io/address/${s}?cluster=devnet`;
}

function shortPk(pk: string | PublicKey): string {
  const s = typeof pk === "string" ? pk : pk.toBase58();
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function refreshIdsTable() {
  const setLink = (a: HTMLAnchorElement, pk: string | null) => {
    while (a.firstChild) a.removeChild(a.firstChild);
    if (!pk) {
      a.textContent = "— provision first —";
      a.removeAttribute("href");
      return;
    }
    a.textContent = pk;
    a.href = explorerAddr(pk);
  };
  setLink(ui.metahookLink, METAHOOK_ID.toBase58());
  setLink(ui.allowlistLink, POLICY_ALLOWLIST_ID.toBase58());
  setLink(ui.sanctionsLink, POLICY_SANCTIONS_ID.toBase58());
  if (state) {
    setLink(ui.mintLink, mintKp(state).publicKey.toBase58());
    setLink(ui.destLink, destKp(state).publicKey.toBase58());
  } else {
    setLink(ui.mintLink, null);
    setLink(ui.destLink, null);
  }
}

function refreshButtons() {
  if (!wallet) {
    ui.provisionBtn.disabled = true;
    ui.transferFailBtn.disabled = true;
    ui.addAllowBtn.disabled = true;
    ui.transferOkBtn.disabled = true;
    if (ui.umbraShieldBtn) ui.umbraShieldBtn.disabled = true;
    activateStep(0);
    return;
  }
  ui.provisionBtn.disabled = false;
  if (!state?.provisioned) {
    activateStep(1);
    ui.transferFailBtn.disabled = true;
    ui.addAllowBtn.disabled = true;
    ui.transferOkBtn.disabled = true;
    if (ui.umbraShieldBtn) ui.umbraShieldBtn.disabled = true;
    return;
  }
  ui.transferFailBtn.disabled = false;
  // Umbra-shield needs a provisioned mint with balance left in the source ATA.
  if (ui.umbraShieldBtn) ui.umbraShieldBtn.disabled = false;
  if (!state.allowlisted) {
    activateStep(state.succeeded ? 4 : 2);
    ui.addAllowBtn.disabled = false;
    ui.transferOkBtn.disabled = false;
    return;
  }
  activateStep(4);
  ui.addAllowBtn.disabled = true;
  ui.transferOkBtn.disabled = false;
}

function renderAuditEvent(evt: AuditEvent | null, receipt: SignedReceipt | null = null) {
  if (!evt) {
    ui.auditEventBox.classList.add("hidden");
    return;
  }
  ui.auditEventBox.classList.remove("hidden");

  // Toggle the rotated stamp into APPROVED/DENIED state
  const stamp = ui.auditEventBox.querySelector(".audit-stamp");
  if (stamp) stamp.classList.toggle("deny", !evt.final);

  // Receipt ID line: short signature + raw discriminator preview
  while (ui.auditReceiptId.firstChild)
    ui.auditReceiptId.removeChild(ui.auditReceiptId.firstChild);
  ui.auditReceiptId.appendChild(document.createTextNode(
    `RECEIPT · ${evt.rawBase64.slice(0, 14)}…${evt.rawBase64.slice(-8)}`
  ));

  // Receipt body — definition list (dt/dd pairs styled as a 2-column grid)
  // Map per-policy verdict from the audit event's failed_policy_index.
  // V1.1 emits {final, failed_policy_index} instead of named per-policy bools
  // so the schema scales to N policies. We surface both the AND verdict and
  // (when known) which named policy short-circuited the decision.
  const POLICY_NAMES = ["allowlist", "sanctions"]; // matches MetaHookConfig order at provision
  const failedIdx = evt.failedPolicyIndex;
  const verdictRows: [string, string, string?][] = POLICY_NAMES.map((name, i) => {
    let label: string;
    let kind: "pass" | "fail";
    if (failedIdx < 0) { label = "pass"; kind = "pass"; }
    else if (i < failedIdx) { label = "pass"; kind = "pass"; }
    else if (i === failedIdx) { label = "fail (short-circuit)"; kind = "fail"; }
    else { label = "skipped"; kind = "fail"; }
    return [`${name} verdict`, label, kind];
  });
  const rows: [string, string, string?][] = [
    ["mint", shortPk(evt.mint)],
    ["source", shortPk(evt.source)],
    ["destination", shortPk(evt.destination)],
    ["amount", evt.amount],
    ...verdictRows,
    ["final decision", evt.final ? "APPROVE" : "REJECT", evt.final ? "pass" : "fail"],
  ];
  while (ui.auditEventTable.firstChild)
    ui.auditEventTable.removeChild(ui.auditEventTable.firstChild);
  for (const [k, v, kind] of rows) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = k;
    dd.textContent = v;
    if (kind) dd.className = kind;
    ui.auditEventTable.appendChild(dt);
    ui.auditEventTable.appendChild(dd);
  }

  renderSignedReceipt(receipt);
}

async function refreshAuditFeed() {
  if (!programs || !wallet || !state?.provisioned) return;
  const box = document.getElementById("auditFeedBox");
  const list = document.getElementById("auditFeedList");
  const empty = document.getElementById("auditFeedEmpty");
  if (!box || !list || !empty) return;
  box.classList.remove("hidden");
  while (list.firstChild) list.removeChild(list.firstChild);

  const mint = mintKp(state).publicKey;
  const sourceAta = getAssociatedTokenAddressSync(
    mint,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  let entries: AuditFeedEntry[] = [];
  try {
    entries = await fetchAuditFeed(connection, programs, sourceAta, 10);
  } catch (e) {
    console.error("audit feed fetch failed", e);
    empty.classList.remove("hidden");
    empty.textContent = "audit feed fetch failed (RPC issue) — retry later";
    return;
  }

  if (entries.length === 0) {
    empty.classList.remove("hidden");
    empty.textContent = "no audit events yet — run a transfer above";
    return;
  }
  empty.classList.add("hidden");

  for (const entry of entries) {
    list.appendChild(renderAuditFeedEntry(entry));
  }
}

function renderAuditFeedEntry(entry: AuditFeedEntry): HTMLElement {
  const li = document.createElement("li");
  li.className = `audit-feed-entry audit-feed-entry-${entry.status}`;

  const left = document.createElement("div");
  left.className = "audit-feed-left";
  const tag = document.createElement("span");
  tag.className = `audit-feed-tag ${entry.status}`;
  tag.textContent = entry.status === "approved" ? "APPROVED" : "REJECTED";
  left.appendChild(tag);

  const ts = document.createElement("span");
  ts.className = "audit-feed-time";
  ts.textContent = entry.blockTime
    ? new Date(entry.blockTime * 1000).toLocaleString()
    : "pending";
  left.appendChild(ts);

  const right = document.createElement("div");
  right.className = "audit-feed-right";
  const sig = document.createElement("a");
  sig.className = "audit-feed-sig";
  sig.href = `https://solscan.io/tx/${entry.signature}?cluster=devnet`;
  sig.target = "_blank";
  sig.rel = "noopener";
  sig.textContent = `${entry.signature.slice(0, 8)}…${entry.signature.slice(-8)}`;
  right.appendChild(sig);

  if (entry.event) {
    const detail = document.createElement("span");
    detail.className = "audit-feed-detail";
    detail.textContent = `amt ${entry.event.amount} → ${entry.event.destination.slice(0, 4)}…${entry.event.destination.slice(-4)}`;
    right.appendChild(detail);
  } else if (entry.rejectReason) {
    const detail = document.createElement("span");
    detail.className = "audit-feed-detail audit-feed-reason";
    detail.textContent = entry.rejectReason;
    right.appendChild(detail);
  }

  li.appendChild(left);
  li.appendChild(right);
  return li;
}

function renderSignedReceipt(receipt: SignedReceipt | null) {
  // Remove any prior signed-receipt block (re-render-safe).
  const prior = ui.auditEventBox.querySelector(".audit-signed");
  if (prior) prior.remove();
  if (!receipt) return;

  const wrap = document.createElement("div");
  wrap.className = "audit-signed";

  const heading = document.createElement("h3");
  heading.className = "audit-signed-title";
  heading.textContent = "issuer-signed receipt";
  wrap.appendChild(heading);

  const meta = document.createElement("dl");
  meta.className = "audit-table audit-signed-table";
  const metaRows: [string, string][] = [
    ["issuer", shortPk(receipt.issuer)],
    ["signed at", new Date(receipt.signedAt).toUTCString()],
    ["signature", `${receipt.signatureBase58.slice(0, 14)}…${receipt.signatureBase58.slice(-10)}`],
  ];
  for (const [k, v] of metaRows) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = k;
    dd.textContent = v;
    meta.appendChild(dt);
    meta.appendChild(dd);
  }
  wrap.appendChild(meta);

  const details = document.createElement("details");
  details.className = "audit-signed-details";
  const summary = document.createElement("summary");
  summary.textContent = "show signed message + signature";
  details.appendChild(summary);

  const pre = document.createElement("pre");
  pre.className = "audit-signed-message";
  pre.textContent = receipt.message + "\n--\nsignature(base58): " + receipt.signatureBase58;
  details.appendChild(pre);
  wrap.appendChild(details);

  ui.auditEventBox.appendChild(wrap);
}

async function connect() {
  const provider = getPhantomProvider();
  if (!provider) {
    alert(
      "Phantom wallet not detected. Install Phantom from https://phantom.app and refresh."
    );
    return;
  }
  setBusy(ui.connectBtn, true, "Connecting…");
  try {
    await provider.connect();
    wallet = new PhantomWallet(provider);
    connection = new Connection(DEMO_RPC, "confirmed");
    programs = buildPrograms(connection, wallet);

    provider.on("disconnect", () => {
      wallet = null;
      programs = null;
      state = null;
      siwsSession = null;
      renderWallet();
      refreshButtons();
      refreshIdsTable();
    });
    provider.on("accountChanged", (pk: PublicKey | null) => {
      if (!pk) {
        wallet = null;
        programs = null;
        state = null;
        siwsSession = null;
      } else {
        wallet = new PhantomWallet(provider);
        programs = buildPrograms(connection, wallet);
        state = loadState(wallet.publicKey);
        siwsSession = loadSession(wallet.publicKey);
      }
      renderWallet();
      refreshButtons();
      refreshIdsTable();
    });

    state = loadState(wallet.publicKey);
    if (!state) {
      state = makeFreshState();
      saveState(wallet.publicKey, state);
    }

    // Restore SIWS session if one exists for this issuer pubkey.
    siwsSession = loadSession(wallet.publicKey);

    renderWallet();
    refreshButtons();
    refreshIdsTable();

    const log = makeLogger(ui.provisionLog);
    clearLog(ui.provisionLog);
    log("connected", "ok");
    await ensureMinBalance(connection, wallet.publicKey, 0.5, log);

    // If returning user has an existing provisioned mint, populate the
    // audit feed immediately so they see their full history without
    // having to re-run a transfer first.
    if (state?.provisioned) {
      refreshAuditFeed().catch(() => {});
    }
  } catch (e: any) {
    alert(`Connect failed: ${e.message ?? e}`);
  } finally {
    setBusy(ui.connectBtn, false);
  }
}

function renderWallet() {
  while (ui.walletStatus.firstChild)
    ui.walletStatus.removeChild(ui.walletStatus.firstChild);
  if (!wallet) {
    const btn = document.createElement("button");
    btn.id = "connectBtn";
    btn.className = "btn btn-primary";
    btn.textContent = "Connect Phantom";
    btn.onclick = connect;
    ui.connectBtn = btn;
    ui.walletStatus.appendChild(btn);
    return;
  }
  const pill = document.createElement("span");
  pill.className = "wallet-pill";
  const dot = document.createElement("span");
  dot.className = "dot";
  pill.appendChild(dot);
  pill.appendChild(document.createTextNode("devnet · "));
  const strong = document.createElement("strong");
  strong.textContent = shortPk(wallet.publicKey);
  pill.appendChild(strong);
  ui.walletStatus.appendChild(pill);

  // SIWS session UI: either "Sign in as issuer" button or active session pill.
  if (siwsSession) {
    const sessionPill = document.createElement("span");
    sessionPill.className = "siws-pill";
    const tag = document.createElement("span");
    tag.className = "siws-pill-tag";
    tag.textContent = "ISSUER";
    sessionPill.appendChild(tag);
    const remaining = Math.max(
      0,
      Math.floor((new Date(siwsSession.expiresAt).getTime() - Date.now()) / 60000)
    );
    sessionPill.appendChild(
      document.createTextNode(` · session ${remaining}m`)
    );
    const out = document.createElement("button");
    out.className = "siws-pill-out";
    out.textContent = "sign out";
    out.onclick = onSiwsSignOut;
    sessionPill.appendChild(out);
    ui.walletStatus.appendChild(sessionPill);
  } else {
    const siwsBtn = document.createElement("button");
    siwsBtn.id = "siwsBtn";
    siwsBtn.className = "btn btn-ghost";
    siwsBtn.textContent = "Sign in as issuer";
    siwsBtn.onclick = onSiwsSignIn;
    ui.walletStatus.appendChild(siwsBtn);
  }
}

async function onSiwsSignIn() {
  if (!wallet) return;
  try {
    siwsSession = await issuerSignIn(wallet);
    renderWallet();
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    if (/reject|denied|user.*cancel/i.test(msg)) {
      // Silent decline — leave UI alone.
      return;
    }
    alert(`Sign-in failed: ${msg}`);
  }
}

function onSiwsSignOut() {
  if (!wallet) return;
  clearSession(wallet.publicKey);
  siwsSession = null;
  renderWallet();
}

async function onProvision() {
  if (!programs || !wallet || !state) return;
  const log = makeLogger(ui.provisionLog);
  setBusy(ui.provisionBtn, true, "Provisioning…");
  try {
    await provision(programs, state, log);
    saveState(wallet.publicKey, state);
    refreshButtons();
    refreshIdsTable();
    refreshAuditFeed().catch(() => {});
  } catch (e: any) {
    log(`provision failed: ${e.message ?? e}`, "bad");
  } finally {
    setBusy(ui.provisionBtn, false);
  }
}

async function onTransferFail() {
  if (!programs || !wallet || !state) return;
  clearLog(ui.transferFailLog);
  const log = makeLogger(ui.transferFailLog);
  setBusy(ui.transferFailBtn, true, "Sending…");
  try {
    const r = await tryTransferExpectFail(programs, state, log);
    if (r.failed && r.reason === "policy.allowlist.fail") {
      log("as designed: MetaHook blocked the transfer at the allowlist policy.", "ok");
    } else if (!r.failed) {
      log("transfer succeeded — destination may already be on allowlist.", "warn");
    }
    refreshAuditFeed().catch(() => {});
  } catch (e: any) {
    log(`unexpected error: ${e.message ?? e}`, "bad");
  } finally {
    setBusy(ui.transferFailBtn, false);
  }
}

async function onAddAllow() {
  if (!programs || !wallet || !state) return;
  clearLog(ui.addAllowLog);
  const log = makeLogger(ui.addAllowLog);
  setBusy(ui.addAllowBtn, true, "Adding…");
  try {
    await addDestinationToAllowlist(programs, state, log);
    saveState(wallet.publicKey, state);
    refreshButtons();
  } catch (e: any) {
    log(`add failed: ${e.message ?? e}`, "bad");
  } finally {
    setBusy(ui.addAllowBtn, false);
  }
}

async function onTransferOk() {
  if (!programs || !wallet || !state) return;
  clearLog(ui.transferOkLog);
  const log = makeLogger(ui.transferOkLog);
  setBusy(ui.transferOkBtn, true, "Sending…");
  try {
    const evt = await retryTransferExpectSuccess(programs, state, log);
    saveState(wallet.publicKey, state);
    renderAuditEvent(evt);
    refreshButtons();

    // After the on-chain transfer + audit event lands, ask the issuer to
    // sign a portable off-chain receipt that binds the audit-event base64,
    // tx signature, and issuer pubkey. Phantom shows the message verbatim.
    if (evt && wallet) {
      log("requesting issuer signature on receipt…", "info");
      try {
        const receipt = await signAuditReceipt(wallet, evt);
        renderAuditEvent(evt, receipt);
        log("receipt signed by issuer", "ok");
      } catch (signErr: any) {
        const msg = signErr?.message ?? String(signErr);
        if (/reject|denied|user.*cancel/i.test(msg)) {
          log("issuer declined to sign the receipt (the on-chain audit event still stands)", "warn");
        } else {
          log(`receipt signing failed: ${msg}`, "warn");
        }
      }
    }
    refreshAuditFeed().catch(() => {});
  } catch (e: any) {
    log(`transfer failed: ${e.message ?? e}`, "bad");
    log("(if you skipped step 3 the allowlist policy will reject)", "dim");
  } finally {
    setBusy(ui.transferOkBtn, false);
  }
}

async function onUmbraShield() {
  if (!programs || !wallet || !state?.provisioned) return;
  clearLog(ui.umbraShieldLog);
  const log = makeLogger(ui.umbraShieldLog);
  setBusy(ui.umbraShieldBtn, true, "Loading Umbra SDK…");
  try {
    // Dynamic import so the ~2 MB Umbra SDK chunk only downloads when
    // a user actually triggers a shield. Initial page load stays lean.
    const mod = await import("./umbra-shield");
    setBusy(ui.umbraShieldBtn, true, "Shielding…");
    const mint = mintKp(state).publicKey;
    log(`composing Umbra shield for ${mint.toBase58().slice(0, 8)}…`, "info");
    const result = await mod.shieldViaUmbra({
      mintBase58: mint.toBase58(),
      recipientBase58: wallet.publicKey.toBase58(),
      amountTokens: 100n,
      rpcUrl: DEMO_RPC,
    });
    log(`shield tx: ${result.signature.slice(0, 12)}…`, "ok",
        `https://solscan.io/tx/${result.signature}?cluster=devnet`);
    log(`100 tokens shielded — balance now hidden in Umbra encrypted account`, "ok");
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    if (/policy\.allowlist\.fail/i.test(msg)) {
      log("MetaHook rejected the shield: Umbra's program PDA isn't on your allowlist.", "warn");
      log("This is the composability story — compliance fired BEFORE the privacy layer.", "dim");
      log("Add Umbra's program PDA to your allowlist to enable shielded compliant transfers.", "dim");
    } else {
      log(`shield failed: ${msg}`, "bad");
    }
  } finally {
    setBusy(ui.umbraShieldBtn, false);
    refreshAuditFeed().catch(() => {});
  }
}

function onReset() {
  if (!wallet) return;
  if (!confirm("Reset demo state? Your mint + dest keys will be regenerated.")) return;
  clearState(wallet.publicKey);
  state = makeFreshState();
  saveState(wallet.publicKey, state);
  clearLog(ui.provisionLog);
  clearLog(ui.transferFailLog);
  clearLog(ui.addAllowLog);
  clearLog(ui.transferOkLog);
  ui.auditEventBox.classList.add("hidden");
  refreshButtons();
  refreshIdsTable();
}

async function init() {
  // Dev-only: if `?test=1` is present and we're in dev, install a mock
  // provider before any wallet detection runs. No-op in production.
  await maybeInstallTestProvider();

  // Surface the active RPC provider in the footer so judges (and ourselves
  // during demos) can see which path is in use without opening devtools.
  // Multi-provider priority: RPC Fast > QuickNode > Helius > public devnet.
  const footer = document.getElementById("footerStack");
  if (footer) {
    const rpcLabel =
      RPC_PROVIDER === "rpcfast"
        ? "RPC Fast (QuickNode + Helius + public devnet on standby)"
        : RPC_PROVIDER === "quicknode"
        ? "QuickNode RPC (Helius + public devnet on standby)"
        : RPC_PROVIDER === "helius"
        ? "Helius RPC (public devnet on standby)"
        : "public devnet RPC (set VITE_RPCFAST_DEVNET, VITE_QUICKNODE_DEVNET, or VITE_HELIUS_KEY for higher tier)";
    footer.textContent = `Anchor v0.32.1 · Token-2022 · Solana devnet · ${rpcLabel}`;
  }

  ui.connectBtn.onclick = connect;
  ui.provisionBtn.onclick = onProvision;
  ui.transferFailBtn.onclick = onTransferFail;
  ui.addAllowBtn.onclick = onAddAllow;
  ui.transferOkBtn.onclick = onTransferOk;
  if (ui.umbraShieldBtn) ui.umbraShieldBtn.onclick = onUmbraShield;
  ui.resetBtn.onclick = onReset;
  refreshIdsTable();

  // Mount the live-mint analytics section. The renderer reads VITE_MAINNET_MINT
  // + VITE_GOLDRUSH_KEY + VITE_BIRDEYE_KEY + VITE_DUNE_DASHBOARD_URL at call
  // time and renders gracefully when any of them are unset.
  const analyticsBox = document.getElementById("analyticsBox");
  if (analyticsBox) {
    mountAnalytics(analyticsBox).catch((e) => {
      console.error("analytics mount failed", e);
    });
  }

  const provider = getPhantomProvider();
  if (provider?.isConnected || provider?.publicKey) {
    connect().catch(() => {});
  } else if (provider) {
    provider
      .connect({ onlyIfTrusted: true })
      .then(() => connect().catch(() => {}))
      .catch(() => {});
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    init().catch((e) => console.error("init failed", e));
  });
} else {
  init().catch((e) => console.error("init failed", e));
}
