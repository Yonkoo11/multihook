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
  tryTransferExpectFail,
} from "./demo";

interface UI {
  walletStatus: HTMLElement;
  connectBtn: HTMLButtonElement;
  provisionBtn: HTMLButtonElement;
  transferFailBtn: HTMLButtonElement;
  addAllowBtn: HTMLButtonElement;
  transferOkBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
  provisionLog: HTMLElement;
  transferFailLog: HTMLElement;
  addAllowLog: HTMLElement;
  transferOkLog: HTMLElement;
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
  resetBtn: document.getElementById("resetBtn") as HTMLButtonElement,
  provisionLog: document.getElementById("provisionLog")!,
  transferFailLog: document.getElementById("transferFailLog")!,
  addAllowLog: document.getElementById("addAllowLog")!,
  transferOkLog: document.getElementById("transferOkLog")!,
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
    activateStep(0);
    return;
  }
  ui.provisionBtn.disabled = false;
  if (!state?.provisioned) {
    activateStep(1);
    ui.transferFailBtn.disabled = true;
    ui.addAllowBtn.disabled = true;
    ui.transferOkBtn.disabled = true;
    return;
  }
  ui.transferFailBtn.disabled = false;
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

function renderAuditEvent(evt: AuditEvent | null) {
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
  const rows: [string, string, string?][] = [
    ["mint", shortPk(evt.mint)],
    ["source", shortPk(evt.source)],
    ["destination", shortPk(evt.destination)],
    ["amount", evt.amount],
    ["allowlist verdict", evt.allowlistPass ? "pass" : "fail", evt.allowlistPass ? "pass" : "fail"],
    ["sanctions verdict", evt.sanctionsPass ? "pass" : "fail", evt.sanctionsPass ? "pass" : "fail"],
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
      renderWallet();
      refreshButtons();
      refreshIdsTable();
    });
    provider.on("accountChanged", (pk: PublicKey | null) => {
      if (!pk) {
        wallet = null;
        programs = null;
        state = null;
      } else {
        wallet = new PhantomWallet(provider);
        programs = buildPrograms(connection, wallet);
        state = loadState(wallet.publicKey);
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

    renderWallet();
    refreshButtons();
    refreshIdsTable();

    const log = makeLogger(ui.provisionLog);
    clearLog(ui.provisionLog);
    log("connected", "ok");
    await ensureMinBalance(connection, wallet.publicKey, 0.5, log);
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
  } catch (e: any) {
    log(`transfer failed: ${e.message ?? e}`, "bad");
    log("(if you skipped step 3 the allowlist policy will reject)", "dim");
  } finally {
    setBusy(ui.transferOkBtn, false);
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
  const footer = document.getElementById("footerStack");
  if (footer) {
    const rpcLabel = RPC_PROVIDER === "helius"
      ? "Helius RPC"
      : "public devnet RPC (set VITE_HELIUS_KEY for higher tier)";
    footer.textContent = `Anchor v0.32.1 · Token-2022 · Solana devnet · ${rpcLabel}`;
  }

  ui.connectBtn.onclick = connect;
  ui.provisionBtn.onclick = onProvision;
  ui.transferFailBtn.onclick = onTransferFail;
  ui.addAllowBtn.onclick = onAddAllow;
  ui.transferOkBtn.onclick = onTransferOk;
  ui.resetBtn.onclick = onReset;
  refreshIdsTable();

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
