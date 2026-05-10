/**
 * Dune integration for the Live Mint Analytics panel.
 *
 * Dune doesn't expose a useful client-side query API on the free tier —
 * the natural integration shape is publishing a public dashboard on Dune
 * and embedding it via iframe. The actual SQL lives at dune/audit_events.sql
 * and is the load-bearing artifact for this integration; the iframe is just
 * the surface.
 *
 * Why a Dune dashboard for MetaHook:
 *   - The MetaHookAuditEvent base64 in `Program data:` log lines is the
 *     only on-chain record of per-policy verdicts — every Solana indexer
 *     that doesn't decode it (which is all of them, by default) misses
 *     the compliance signal entirely
 *   - A public Dune dashboard with the decoded event becomes the canonical
 *     "did the system actually approve/reject" view that compliance teams
 *     can subscribe to, replacing custom indexer infra
 *
 * The dashboard URL is configured at build time via VITE_DUNE_DASHBOARD_URL.
 * Unset → render a placeholder explaining what publishing the dashboard
 * unlocks + a link to the SQL source.
 */

export interface DuneEmbedConfig {
  dashboardUrl: string | null;
  sqlSourcePath: string;
}

export function getDuneEmbedConfig(): DuneEmbedConfig {
  // Literal env access — see programs.ts note on Vite static substitution.
  const url =
    (import.meta.env.VITE_DUNE_DASHBOARD_URL as string | undefined)?.trim() ??
    "";
  return {
    dashboardUrl: url.length > 0 ? url : null,
    sqlSourcePath: "dune/audit_events.sql",
  };
}
