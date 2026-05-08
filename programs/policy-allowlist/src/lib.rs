use anchor_lang::prelude::*;

declare_id!("GJHxobVdfywhTidD9u4EoYPGa9kBQVzEcZ7kDhVZehyn");

/// V1 caps allowlist at 32 entries to keep account size constant.
/// Phase 2: realloc + paginated reads.
pub const MAX_ALLOWLIST_ENTRIES: usize = 32;

/// policy-allowlist — child policy that approves a transfer only when the
/// destination owner appears in the allowlist account.
#[program]
pub mod policy_allowlist {
    use super::*;

    /// Create the allowlist PDA. `authority` becomes the only key that can
    /// add or remove addresses afterwards.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let allowlist = &mut ctx.accounts.allowlist;
        allowlist.authority = ctx.accounts.authority.key();
        allowlist.entries = Vec::new();
        Ok(())
    }

    pub fn add_allowed(ctx: Context<AdminMutate>, addr: Pubkey) -> Result<()> {
        let allowlist = &mut ctx.accounts.allowlist;
        require!(
            allowlist.entries.len() < MAX_ALLOWLIST_ENTRIES,
            AllowlistError::ListFull
        );
        if !allowlist.entries.contains(&addr) {
            allowlist.entries.push(addr);
        }
        Ok(())
    }

    pub fn remove_allowed(ctx: Context<AdminMutate>, addr: Pubkey) -> Result<()> {
        let allowlist = &mut ctx.accounts.allowlist;
        allowlist.entries.retain(|x| x != &addr);
        Ok(())
    }

    /// MetaHook CPIs into this. Account order matches the SPL transfer-hook
    /// account convention (source, mint, destination, owner) plus the
    /// allowlist PDA at the tail.
    pub fn check_transfer(ctx: Context<CheckTransfer>, _amount: u64) -> Result<()> {
        let dest_data = ctx.accounts.destination_token.try_borrow_data()?;
        require!(dest_data.len() >= 64, AllowlistError::TokenAccountTooSmall);
        let dest_owner = Pubkey::try_from(&dest_data[32..64])
            .map_err(|_| error!(AllowlistError::TokenAccountTooSmall))?;
        require!(
            ctx.accounts.allowlist.entries.contains(&dest_owner),
            AllowlistError::DestinationNotAllowed
        );
        Ok(())
    }
}

#[account]
pub struct Allowlist {
    pub authority: Pubkey,
    pub entries: Vec<Pubkey>,
}

impl Allowlist {
    pub const SPACE: usize = 8        // anchor discriminator
        + 32                          // authority
        + 4                           // Vec length prefix
        + 32 * MAX_ALLOWLIST_ENTRIES; // max entries
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = Allowlist::SPACE,
        seeds = [b"allowlist", authority.key().as_ref()],
        bump,
    )]
    pub allowlist: Account<'info, Allowlist>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminMutate<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority @ AllowlistError::Unauthorized,
        seeds = [b"allowlist", authority.key().as_ref()],
        bump,
    )]
    pub allowlist: Account<'info, Allowlist>,
}

/// Account context the MetaHook passes when CPI'ing into us. Token accounts
/// arrive as UncheckedAccount — Token-2022 has already validated them and
/// re-validating here just burns CU. We only crack the destination's owner
/// field at offset 32..64 inside check_transfer.
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

    pub allowlist: Account<'info, Allowlist>,
}

#[error_code]
pub enum AllowlistError {
    #[msg("policy.allowlist.fail: destination not on allowlist")]
    DestinationNotAllowed,
    #[msg("Allowlist is full (V1 cap = 32)")]
    ListFull,
    #[msg("Caller is not the allowlist authority")]
    Unauthorized,
    #[msg("Token account data too small to read owner")]
    TokenAccountTooSmall,
}
