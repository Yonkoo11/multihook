/**
 * Live Mint Analytics renderer — composes the GoldRush + Birdeye + Dune
 * panels into the analytics section. Each panel handles its own loading +
 * error + empty state so a single API outage doesn't blank the page.
 *
 * Activation rules:
 *   - VITE_MAINNET_MINT must be set or the whole section renders a single
 *     "configuring" placeholder instead of attempting empty calls
 *   - VITE_GOLDRUSH_KEY / VITE_BIRDEYE_KEY presence gates each respective
 *     panel; if a key is missing the panel renders "configure to activate"
 *     rather than failing the network request
 *   - VITE_DUNE_DASHBOARD_URL presence gates the iframe embed; unset →
 *     placeholder pointing at dune/audit_events.sql
 */
import {
  GoldRushSnapshot,
  fetchMintSnapshot,
} from "./analytics-goldrush";
import {
  BirdeyeSnapshot,
  fetchMintAnalytics,
} from "./analytics-birdeye";
import { getDuneEmbedConfig } from "./analytics-dune";

const SOLSCAN_ADDR = (a: string) =>
  `https://solscan.io/account/${a}`; // mainnet, no ?cluster=
const SOLSCAN_TX = (s: string) => `https://solscan.io/tx/${s}`;

function shortAddr(s: string): string {
  if (!s) return "—";
  return s.length > 12 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s;
}

function fmtRaw(amount: string | number, decimals: number = 0): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!isFinite(n)) return String(amount);
  if (decimals === 0) return n.toLocaleString();
  const div = Math.pow(10, decimals);
  return (n / div).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function makePanel(title: string, source: string): {
  panel: HTMLElement;
  body: HTMLElement;
} {
  const panel = document.createElement("article");
  panel.className = "analytics-panel";
  const head = document.createElement("header");
  head.className = "analytics-panel-head";
  const h = document.createElement("h3");
  h.textContent = title;
  const src = document.createElement("span");
  src.className = "analytics-panel-source";
  src.textContent = source;
  head.appendChild(h);
  head.appendChild(src);
  const body = document.createElement("div");
  body.className = "analytics-panel-body";
  panel.appendChild(head);
  panel.appendChild(body);
  return { panel, body };
}

function loadingNote(): HTMLElement {
  const el = document.createElement("p");
  el.className = "analytics-state analytics-state-loading";
  el.textContent = "loading…";
  return el;
}

function errorNote(reason: string, hint?: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "analytics-state analytics-state-error";
  const r = document.createElement("p");
  r.textContent = reason;
  wrap.appendChild(r);
  if (hint) {
    const h = document.createElement("p");
    h.className = "analytics-state-hint";
    h.textContent = hint;
    wrap.appendChild(h);
  }
  return wrap;
}

function placeholderNote(message: string, hint?: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "analytics-state analytics-state-placeholder";
  const p = document.createElement("p");
  p.textContent = message;
  wrap.appendChild(p);
  if (hint) {
    const h = document.createElement("p");
    h.className = "analytics-state-hint";
    h.textContent = hint;
    wrap.appendChild(h);
  }
  return wrap;
}

function clear(el: HTMLElement) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function renderGoldRushPanel(snap: GoldRushSnapshot, body: HTMLElement) {
  clear(body);

  // Top stats row
  const stats = document.createElement("div");
  stats.className = "analytics-stats";
  const stat = (label: string, value: string) => {
    const s = document.createElement("div");
    s.className = "analytics-stat";
    const l = document.createElement("span");
    l.className = "label";
    l.textContent = label;
    const v = document.createElement("span");
    v.className = "value";
    v.textContent = value;
    s.appendChild(l);
    s.appendChild(v);
    return s;
  };
  stats.appendChild(stat("total holders", snap.totalHolders.toLocaleString()));
  stats.appendChild(stat("recent txs", snap.recentTxs.length.toLocaleString()));
  body.appendChild(stats);

  // Top holders list
  if (snap.topHolders.length > 0) {
    const heading = document.createElement("h4");
    heading.className = "analytics-subhead";
    heading.textContent = "top 5 holders";
    body.appendChild(heading);

    const ul = document.createElement("ul");
    ul.className = "analytics-list";
    for (const h of snap.topHolders) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = SOLSCAN_ADDR(h.address);
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = shortAddr(h.address);
      li.appendChild(a);
      const bal = document.createElement("span");
      bal.className = "analytics-list-value";
      bal.textContent = fmtRaw(h.balance);
      li.appendChild(bal);
      ul.appendChild(li);
    }
    body.appendChild(ul);
  }

  // Recent txs list
  if (snap.recentTxs.length > 0) {
    const heading = document.createElement("h4");
    heading.className = "analytics-subhead";
    heading.textContent = "recent transactions";
    body.appendChild(heading);

    const ul = document.createElement("ul");
    ul.className = "analytics-list analytics-list-tx";
    for (const t of snap.recentTxs.slice(0, 5)) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = SOLSCAN_TX(t.signature);
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = shortAddr(t.signature);
      li.appendChild(a);
      const ts = document.createElement("span");
      ts.className = "analytics-list-value";
      ts.textContent = new Date(t.block_signed_at).toLocaleString();
      li.appendChild(ts);
      const ok = document.createElement("span");
      ok.className = `analytics-tag ${t.successful ? "ok" : "bad"}`;
      ok.textContent = t.successful ? "ok" : "fail";
      li.appendChild(ok);
      ul.appendChild(li);
    }
    body.appendChild(ul);
  }

  if (snap.topHolders.length === 0 && snap.recentTxs.length === 0) {
    body.appendChild(
      placeholderNote(
        "no holders or transactions yet",
        "GoldRush has indexed the mint but it has no on-chain activity"
      )
    );
  }
}

function renderBirdeyePanel(snap: BirdeyeSnapshot, body: HTMLElement) {
  clear(body);

  const stats = document.createElement("div");
  stats.className = "analytics-stats analytics-stats-birdeye";
  const stat = (label: string, value: string, kind?: "pos" | "neg") => {
    const s = document.createElement("div");
    s.className = "analytics-stat";
    if (kind) s.classList.add(`stat-${kind}`);
    const l = document.createElement("span");
    l.className = "label";
    l.textContent = label;
    const v = document.createElement("span");
    v.className = "value";
    v.textContent = value;
    s.appendChild(l);
    s.appendChild(v);
    return s;
  };

  const o = snap.overview;
  if (o.priceUsd != null) {
    stats.appendChild(stat("price", fmtUsd(o.priceUsd)));
    if (o.priceChange24h != null) {
      const sign = o.priceChange24h >= 0 ? "+" : "";
      stats.appendChild(
        stat(
          "24h change",
          `${sign}${o.priceChange24h.toFixed(2)}%`,
          o.priceChange24h >= 0 ? "pos" : "neg"
        )
      );
    }
    stats.appendChild(stat("market cap", fmtUsd(o.marketCap)));
    stats.appendChild(stat("liquidity", fmtUsd(o.liquidity)));
    stats.appendChild(stat("24h volume", fmtUsd(o.volume24h)));
    stats.appendChild(
      stat("holders", o.holders != null ? o.holders.toLocaleString() : "—")
    );
    body.appendChild(stats);

    if (snap.priceHistory24h.length > 1) {
      body.appendChild(renderSparkline(snap.priceHistory24h.map((p) => p.value)));
    }
  } else {
    body.appendChild(
      placeholderNote(
        "no market data on Birdeye yet",
        "the mint is indexed but has no liquidity pool — analytics activate once a pool exists"
      )
    );
  }
}

function renderSparkline(values: number[]): HTMLElement {
  const w = 320;
  const h = 60;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = w / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = (i * stepX).toFixed(2);
      const y = (h - ((v - min) / range) * h).toFixed(2);
      return `${x},${y}`;
    })
    .join(" ");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "analytics-sparkline");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", `${h}`);
  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyline.setAttribute("points", points);
  polyline.setAttribute("fill", "none");
  polyline.setAttribute("stroke", "currentColor");
  polyline.setAttribute("stroke-width", "1.5");
  svg.appendChild(polyline);
  return svg as unknown as HTMLElement;
}

function renderDunePanel(body: HTMLElement) {
  clear(body);
  const cfg = getDuneEmbedConfig();
  if (cfg.dashboardUrl) {
    const wrap = document.createElement("div");
    wrap.className = "analytics-iframe-wrap";
    const iframe = document.createElement("iframe");
    iframe.className = "analytics-iframe";
    iframe.src = cfg.dashboardUrl;
    iframe.title = "MetaHook audit-event dashboard on Dune";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    wrap.appendChild(iframe);
    body.appendChild(wrap);
  } else {
    body.appendChild(
      placeholderNote(
        "publish dune/audit_events.sql to activate",
        "dashboard URL goes in VITE_DUNE_DASHBOARD_URL"
      )
    );
    const a = document.createElement("a");
    a.className = "analytics-link";
    a.href = "https://github.com/Yonkoo11/multihook/blob/master/dune/audit_events.sql";
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "view SQL source on github →";
    body.appendChild(a);
  }
}

/**
 * Mount the analytics section. Idempotent — calling twice clears + redraws.
 */
export async function mountAnalytics(container: HTMLElement): Promise<void> {
  clear(container);

  // Vite replaces `import.meta.env.VITE_*` at build time. Optional-chain
  // form (`import.meta.env?.VITE_*`) defeats the substitution and the var
  // stays runtime-undefined, so we read the literal expression here.
  const mint = (import.meta.env.VITE_MAINNET_MINT as string | undefined)?.trim();
  const goldrushKey = (import.meta.env.VITE_GOLDRUSH_KEY as string | undefined)?.trim();
  const birdeyeKey = (import.meta.env.VITE_BIRDEYE_KEY as string | undefined)?.trim();

  // Section header
  const head = document.createElement("header");
  head.className = "analytics-head";
  const title = document.createElement("h2");
  title.className = "analytics-title";
  title.textContent = "Live mint analytics";
  head.appendChild(title);
  const sub = document.createElement("p");
  sub.className = "analytics-sub";
  if (mint) {
    sub.textContent = `Mainnet mint ${shortAddr(mint)} — three independent indexers reading the same on-chain state.`;
  } else {
    sub.textContent =
      "Activates the moment a mainnet MetaHook mint is configured. Three independent indexers — GoldRush, Birdeye, Dune — read the same on-chain state.";
  }
  head.appendChild(sub);
  container.appendChild(head);

  if (!mint) {
    const note = document.createElement("p");
    note.className = "analytics-state analytics-state-placeholder";
    note.textContent =
      "Set VITE_MAINNET_MINT in app/.env (the Token-2022 mint protected by your mainnet MetaHook deployment) to activate the panels below.";
    container.appendChild(note);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "analytics-grid";
  container.appendChild(grid);

  // ── GoldRush ────────────────────────────────────────────────────────────
  const { panel: goldPanel, body: goldBody } = makePanel("Holders + tx history", "GoldRush · Covalent");
  grid.appendChild(goldPanel);
  if (!goldrushKey) {
    goldBody.appendChild(
      placeholderNote(
        "configure VITE_GOLDRUSH_KEY to activate",
        "free tier: goldrush.dev → API Keys; restrict the key to yonkoo11.github.io"
      )
    );
  } else {
    goldBody.appendChild(loadingNote());
    fetchMintSnapshot(mint).then(
      (snap) => renderGoldRushPanel(snap, goldBody),
      (e) =>
        renderGoldRushPanelFallback(goldBody, e?.message ?? String(e))
    );
  }

  // ── Birdeye ────────────────────────────────────────────────────────────
  const { panel: bePanel, body: beBody } = makePanel("Market data", "Birdeye");
  grid.appendChild(bePanel);
  if (!birdeyeKey) {
    beBody.appendChild(
      placeholderNote(
        "configure VITE_BIRDEYE_KEY to activate",
        "docs.birdeye.so → authentication; restrict the key to yonkoo11.github.io"
      )
    );
  } else {
    beBody.appendChild(loadingNote());
    fetchMintAnalytics(mint).then(
      (snap) => renderBirdeyePanel(snap, beBody),
      (e) =>
        renderBirdeyePanelFallback(beBody, e?.message ?? String(e))
    );
  }

  // ── Dune ───────────────────────────────────────────────────────────────
  const { panel: dunePanel, body: duneBody } = makePanel(
    "Audit-event dashboard",
    "Dune · custom SQL"
  );
  grid.appendChild(dunePanel);
  renderDunePanel(duneBody);
}

function renderGoldRushPanelFallback(body: HTMLElement, msg: string) {
  clear(body);
  body.appendChild(
    errorNote("GoldRush request failed", msg.slice(0, 220))
  );
}
function renderBirdeyePanelFallback(body: HTMLElement, msg: string) {
  clear(body);
  body.appendChild(errorNote("Birdeye request failed", msg.slice(0, 220)));
}
