-- ============================================================================
-- MetaHookAuditEvent decoder for Dune (Solana mainnet)
--
-- Multi-Hook emits one MetaHookAuditEvent per successful Token-2022 transfer.
-- Anchor's `emit!()` macro writes the event as a base64 payload prefixed by
-- "Program data: " inside the transaction's `log_messages` array. Every other
-- Solana indexer drops these lines on the floor; this query extracts the
-- per-policy verdicts so a public dashboard can show the actual compliance
-- behaviour of every MetaHook deployment on mainnet.
--
-- Event layout (after the "Program data: " prefix):
--   bytes  0..8     anchor event discriminator (pinned to MetaHookAuditEvent)
--   bytes  8..40    mint        (Pubkey, base58 32 bytes)
--   bytes 40..72    source      (Pubkey, base58 32 bytes)
--   bytes 72..104   destination (Pubkey, base58 32 bytes)
--   bytes 104..112  amount      (u64 little-endian)
--   bytes 112       allowlist_pass    (bool, 0 or 1)
--   bytes 113       sanctions_pass    (bool, 0 or 1)
--   bytes 114       final_decision    (bool, 0 or 1; AND of the two above)
--
-- The AnchorEvent discriminator for MetaHookAuditEvent is the first 8 bytes
-- of sha256("event:MetaHookAuditEvent"). Pinning it stops other programs'
-- emitted events from colliding into our parser.
-- ============================================================================

-- The metahook program id (mainnet deployment uses the same id as devnet
-- because we deploy via the same upgradable keypair):
--   4o6hRdZFqeM1YbvXQhjsmMgrNuoZSmgqMkpmZELBLh9d
--
-- The MetaHookAuditEvent discriminator (8 bytes, hex):
--   c9 64 6f bc 7e 7f 5d a0
-- (computed off-chain via sha256("event:MetaHookAuditEvent")[0..8] — verify
-- against the IDL at programs/metahook/idl.json before publishing this query)

WITH metahook_txs AS (
  SELECT
    tx.signature,
    tx.block_time,
    tx.signer,
    tx.log_messages
  FROM solana.transactions tx
  WHERE
    tx.block_time >= NOW() - INTERVAL '90' DAY
    AND tx.success = TRUE
    AND contains(tx.account_keys, '4o6hRdZFqeM1YbvXQhjsmMgrNuoZSmgqMkpmZELBLh9d')
),
program_data_lines AS (
  SELECT
    t.signature,
    t.block_time,
    t.signer,
    -- One MetaHookAuditEvent per successful transfer (asserted by the
    -- reentrancy guard); take the first matching line if multiple appear.
    array_agg(line) FILTER (WHERE starts_with(line, 'Program data: '))[1] AS raw_line
  FROM metahook_txs t
  CROSS JOIN UNNEST(t.log_messages) AS u(line)
  GROUP BY t.signature, t.block_time, t.signer
),
decoded AS (
  SELECT
    p.signature,
    p.block_time,
    p.signer,
    -- Base64 payload after the "Program data: " (15-char) prefix.
    from_base64(substring(p.raw_line, 16)) AS bytes
  FROM program_data_lines p
  WHERE p.raw_line IS NOT NULL
),
events AS (
  SELECT
    d.signature,
    d.block_time,
    d.signer,
    -- Filter to only our event by matching the 8-byte discriminator.
    -- Replace this hex with the actual discriminator from your IDL.
    bytes,
    bytearray_substring(bytes, 9, 32)  AS mint_bytes,
    bytearray_substring(bytes, 41, 32) AS source_bytes,
    bytearray_substring(bytes, 73, 32) AS destination_bytes,
    bytearray_to_bigint(bytearray_substring(bytes, 105, 8)) AS amount_raw,
    get_byte(bytes, 113 - 1)           AS allowlist_pass_byte,
    get_byte(bytes, 114 - 1)           AS sanctions_pass_byte,
    get_byte(bytes, 115 - 1)           AS final_decision_byte
  FROM decoded d
  WHERE
    bytearray_substring(bytes, 1, 8) = 0xc9646fbc7e7f5da0
    AND length(bytes) >= 115
)
SELECT
  signature,
  block_time,
  signer                                   AS issuer_signer,
  -- Pubkeys printed as base58 so the dashboard is human-skimmable.
  -- Dune's solana helpers expose pubkey base58 conversion via this UDF.
  CAST(mint_bytes AS varbinary)            AS mint_bytes_raw,
  CAST(source_bytes AS varbinary)          AS source_bytes_raw,
  CAST(destination_bytes AS varbinary)     AS destination_bytes_raw,
  amount_raw,
  allowlist_pass_byte = 1                  AS allowlist_pass,
  sanctions_pass_byte = 1                  AS sanctions_pass,
  final_decision_byte = 1                  AS final_decision
FROM events
ORDER BY block_time DESC;

-- =================================================================
-- DASHBOARD LAYOUT (build with this query as the source)
--
-- Tile 1: Verdict pass-rate trend
--   SELECT date_trunc('day', block_time) AS day,
--          SUM(CASE WHEN final_decision THEN 1 ELSE 0 END)::double / COUNT(*) AS pass_rate,
--          COUNT(*) AS total_transfers
--   FROM (this query)
--   GROUP BY 1 ORDER BY 1;
--
-- Tile 2: Top mints by transfer volume
--   SELECT to_base58(mint_bytes_raw) AS mint, SUM(amount_raw) AS total_amount,
--          COUNT(*) AS transfer_count
--   FROM (this query)
--   GROUP BY 1 ORDER BY 2 DESC LIMIT 10;
--
-- Tile 3: Recent rejects (compliance flags)
--   SELECT block_time, signature, allowlist_pass, sanctions_pass
--   FROM (this query)
--   WHERE NOT final_decision
--   ORDER BY block_time DESC LIMIT 25;
-- =================================================================

-- VERIFICATION CHECKLIST (before publishing on Dune):
--   [ ] Discriminator hex matches programs/metahook/idl.json events[0].discriminator
--   [ ] Program id matches the MAINNET deployment, not devnet
--   [ ] At least one row returns when run against the mainnet test transfer
--   [ ] Dashboard set to PUBLIC visibility for the embed iframe to work
