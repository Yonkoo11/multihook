use anchor_lang::prelude::*;

declare_id!("5iz6WXUksBqCQTBVkKYdeWtRJYwMZWiofM9AvSQDJkWt");

pub const MAX_SANCTIONED_ENTRIES: usize = 64;

/// policy-sanctions-ofac — child policy that REJECTS a transfer when the
/// destination owner appears in the sanctioned-addresses list.
/// Inverted shape vs. policy-allowlist.
#[program]
pub mod policy_sanctions_ofac {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let list = &mut ctx.accounts.ofac_list;
        list.authority = ctx.accounts.authority.key();
        list.entries = Vec::new();
        Ok(())
    }

    pub fn add_sanctioned(ctx: Context<AdminMutate>, addr: Pubkey) -> Result<()> {
        let list = &mut ctx.accounts.ofac_list;
        require!(
            list.entries.len() < MAX_SANCTIONED_ENTRIES,
            SanctionsError::ListFull
        );
        if !list.entries.contains(&addr) {
            list.entries.push(addr);
        }
        Ok(())
    }

    pub fn remove_sanctioned(ctx: Context<AdminMutate>, addr: Pubkey) -> Result<()> {
        let list = &mut ctx.accounts.ofac_list;
        list.entries.retain(|x| x != &addr);
        Ok(())
    }

    pub fn check_transfer(ctx: Context<CheckTransfer>, _amount: u64) -> Result<()> {
        let dest_data = ctx.accounts.destination_token.try_borrow_data()?;
        require!(dest_data.len() >= 64, SanctionsError::TokenAccountTooSmall);
        let dest_owner = Pubkey::try_from(&dest_data[32..64])
            .map_err(|_| error!(SanctionsError::TokenAccountTooSmall))?;
        require!(
            !ctx.accounts.ofac_list.entries.contains(&dest_owner),
            SanctionsError::DestinationSanctioned
        );
        Ok(())
    }
}

#[account]
pub struct OFACList {
    pub authority: Pubkey,
    pub entries: Vec<Pubkey>,
}

impl OFACList {
    pub const SPACE: usize = 8 + 32 + 4 + 32 * MAX_SANCTIONED_ENTRIES;
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = OFACList::SPACE,
        seeds = [b"ofac-list", authority.key().as_ref()],
        bump,
    )]
    pub ofac_list: Account<'info, OFACList>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminMutate<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority @ SanctionsError::Unauthorized,
        seeds = [b"ofac-list", authority.key().as_ref()],
        bump,
    )]
    pub ofac_list: Account<'info, OFACList>,
}

#[derive(Accounts)]
pub struct CheckTransfer<'info> {
    /// CHECK: validated by Token-2022.
    pub source_token: UncheckedAccount<'info>,
    /// CHECK: validated by Token-2022.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: owner cracked from offset 32..64.
    pub destination_token: UncheckedAccount<'info>,
    /// CHECK: validated by Token-2022.
    pub owner: UncheckedAccount<'info>,

    pub ofac_list: Account<'info, OFACList>,
}

#[error_code]
pub enum SanctionsError {
    #[msg("policy.sanctions.fail: destination is sanctioned")]
    DestinationSanctioned,
    #[msg("OFAC list is full (V1 cap = 64)")]
    ListFull,
    #[msg("Caller is not the OFAC list authority")]
    Unauthorized,
    #[msg("Token account data too small to read owner")]
    TokenAccountTooSmall,
}
