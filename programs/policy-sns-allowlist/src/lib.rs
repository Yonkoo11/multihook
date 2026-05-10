use anchor_lang::prelude::*;

declare_id!("4J57Rh4w6k8VxJAptKVP2v8St273Msy9afskc16qFuTo");

/// Bonfida / Solana Name Service program ID
/// (`namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX`). Hardcoded so issuers
/// cannot substitute a malicious "name service" that always returns the
/// right owner. The bytes below are the base58-decoded program ID; verified
/// via `solana account namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX
/// --url mainnet-beta` (executable, BPF loader owned).
const SNS_PROGRAM_ID: Pubkey = Pubkey::new_from_array([
    0x0b, 0xad, 0x51, 0xf4, 0x13, 0xc1, 0xf3, 0xa9, 0x94, 0x60, 0xd9, 0x00, 0xd8, 0xbf, 0x2e, 0xd6,
    0x92, 0x7e, 0xca, 0x34, 0xd7, 0xb7, 0x84, 0x2b, 0xf8, 0x10, 0xa9, 0x73, 0x08, 0x2d, 0x1e, 0xdc,
]);

/// V1 caps the allowed-domain set at 32 entries to keep the policy account a
/// constant size. Issuers needing more should run multiple SNS-allowlist
/// instances or graduate to the dynamic allowlist (V2).
pub const MAX_DOMAINS: usize = 32;

/// SNS NameRecordHeader layout (offset 0):
///   parent_name: Pubkey   (32)   offset 0..32
///   owner:       Pubkey   (32)   offset 32..64
///   class:       Pubkey   (32)   offset 64..96
const SNS_OWNER_OFFSET: usize = 32;

/// policy-sns-allowlist — third reference policy demonstrating the MetaHook
/// child-policy interface (see POLICY_INTERFACE.md). Approves a transfer only
/// when the destination owner controls one of the authorised `.sol` domains
/// registered with Solana Name Service.
///
/// The issuer's client passes the SNS NameRecord account in the transfer's
/// remaining_accounts; this policy:
///   1. Confirms the NameRecord account is owned by the SNS program (so it
///      is not a forged account).
///   2. Confirms the NameRecord account address is on the authorised set.
///   3. Confirms the NameRecord's `owner` field matches the destination
///      token-account's owner.
///
/// All three checks must pass — defeating both spoofed accounts and stolen
/// "I once controlled this domain" replays.
#[program]
pub mod policy_sns_allowlist {
    use super::*;

    /// Create the SNS allowlist PDA. `authority` becomes the only key that
    /// can add or remove domains afterwards.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let allowlist = &mut ctx.accounts.allowlist;
        allowlist.authority = ctx.accounts.authority.key();
        allowlist.domains = Vec::new();
        Ok(())
    }

    /// Authorise a `.sol` domain by passing its SNS NameRecord PDA. The
    /// caller is responsible for deriving the PDA correctly off-chain via
    /// the Bonfida SDK; on-chain we treat it as an opaque 32-byte tag and
    /// match against the account address presented at transfer time.
    pub fn add_allowed_domain(ctx: Context<AdminMutate>, domain_pda: Pubkey) -> Result<()> {
        let allowlist = &mut ctx.accounts.allowlist;
        require!(allowlist.domains.len() < MAX_DOMAINS, SnsAllowlistError::ListFull);
        if !allowlist.domains.contains(&domain_pda) {
            allowlist.domains.push(domain_pda);
        }
        Ok(())
    }

    pub fn remove_allowed_domain(ctx: Context<AdminMutate>, domain_pda: Pubkey) -> Result<()> {
        let allowlist = &mut ctx.accounts.allowlist;
        allowlist.domains.retain(|x| x != &domain_pda);
        Ok(())
    }

    /// MetaHook CPIs into this. Account order matches the SPL transfer-hook
    /// account convention (source, mint, destination, owner) plus the
    /// allowlist PDA + the SNS NameRecord at the tail.
    pub fn check_transfer(ctx: Context<CheckTransfer>, _amount: u64) -> Result<()> {
        // 1. Crack the destination token-account owner (offset 32..64 of the
        //    SPL Token account layout — same pattern as policy-allowlist).
        let dest_data = ctx.accounts.destination_token.try_borrow_data()?;
        require!(dest_data.len() >= 64, SnsAllowlistError::TokenAccountTooSmall);
        let dest_owner = Pubkey::try_from(&dest_data[32..64])
            .map_err(|_| error!(SnsAllowlistError::TokenAccountTooSmall))?;

        // 2. The SNS NameRecord account must actually belong to the SNS
        //    program; otherwise the issuer (or attacker) could pass any
        //    account whose bytes 32..64 happen to look like the dest owner.
        require!(
            ctx.accounts.sns_name_record.owner == &SNS_PROGRAM_ID,
            SnsAllowlistError::NotAnSnsRecord
        );

        // 3. The NameRecord PDA must be on the authorised set.
        require!(
            ctx.accounts.allowlist.domains.contains(ctx.accounts.sns_name_record.key),
            SnsAllowlistError::DomainNotAllowed
        );

        // 4. The NameRecord's `owner` field must match the destination
        //    token-account's owner. This is the critical bind: it stops a
        //    historical-control replay (someone who used to own alice.sol
        //    cannot accept transfers on its behalf after losing it).
        let name_data = ctx.accounts.sns_name_record.try_borrow_data()?;
        require!(name_data.len() >= 96, SnsAllowlistError::SnsAccountTooSmall);
        let name_owner = Pubkey::try_from(&name_data[SNS_OWNER_OFFSET..SNS_OWNER_OFFSET + 32])
            .map_err(|_| error!(SnsAllowlistError::SnsAccountTooSmall))?;
        require!(
            name_owner == dest_owner,
            SnsAllowlistError::SnsOwnerMismatch
        );

        Ok(())
    }
}

#[account]
pub struct SnsAllowlist {
    pub authority: Pubkey,
    pub domains: Vec<Pubkey>,
}

impl SnsAllowlist {
    pub const SPACE: usize = 8        // anchor discriminator
        + 32                          // authority
        + 4                           // Vec length prefix
        + 32 * MAX_DOMAINS;           // max entries
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = SnsAllowlist::SPACE,
        seeds = [b"sns_allowlist", authority.key().as_ref()],
        bump,
    )]
    pub allowlist: Account<'info, SnsAllowlist>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminMutate<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority @ SnsAllowlistError::Unauthorized,
        seeds = [b"sns_allowlist", authority.key().as_ref()],
        bump,
    )]
    pub allowlist: Account<'info, SnsAllowlist>,
}

/// Account context the MetaHook passes when CPI'ing in. Same prefix as the
/// other reference policies so the issuer can drop SNS into the same
/// ExtraAccountMetaList wiring; the additional `sns_name_record` account
/// is appended at the tail.
#[derive(Accounts)]
pub struct CheckTransfer<'info> {
    /// CHECK: validated by Token-2022 before transfer-hook dispatch.
    pub source_token: UncheckedAccount<'info>,

    /// CHECK: validated by Token-2022.
    pub mint: UncheckedAccount<'info>,

    /// CHECK: token account; owner cracked from offset 32..64.
    pub destination_token: UncheckedAccount<'info>,

    /// CHECK: validated by Token-2022.
    pub owner: UncheckedAccount<'info>,

    pub allowlist: Account<'info, SnsAllowlist>,

    /// CHECK: ownership-checked against SNS_PROGRAM_ID inside check_transfer;
    /// data layout asserted before the offset read.
    pub sns_name_record: UncheckedAccount<'info>,
}

#[error_code]
pub enum SnsAllowlistError {
    #[msg("policy.sns_allowlist.fail: domain not on allowlist")]
    DomainNotAllowed,
    #[msg("policy.sns_allowlist.fail: passed account is not owned by the SNS program")]
    NotAnSnsRecord,
    #[msg("policy.sns_allowlist.fail: SNS NameRecord owner does not match destination owner")]
    SnsOwnerMismatch,
    #[msg("Allowlist is full (V1 cap = 32 domains)")]
    ListFull,
    #[msg("Caller is not the allowlist authority")]
    Unauthorized,
    #[msg("Token account data too small to read owner")]
    TokenAccountTooSmall,
    #[msg("SNS NameRecord account data too small")]
    SnsAccountTooSmall,
}
