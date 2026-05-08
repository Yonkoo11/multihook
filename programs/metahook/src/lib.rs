use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token_interface::Mint;
use spl_tlv_account_resolution::{account::ExtraAccountMeta, state::ExtraAccountMetaList};
use spl_transfer_hook_interface::instruction::{ExecuteInstruction, TransferHookInstruction};

declare_id!("4o6hRdZFqeM1YbvXQhjsmMgrNuoZSmgqMkpmZELBLh9d");

/// V1 child policy program IDs (hardcoded; Phase 2 lifts to a config account).
pub const POLICY_ALLOWLIST_ID: Pubkey = pubkey!("GJHxobVdfywhTidD9u4EoYPGa9kBQVzEcZ7kDhVZehyn");
pub const POLICY_SANCTIONS_ID: Pubkey = pubkey!("5iz6WXUksBqCQTBVkKYdeWtRJYwMZWiofM9AvSQDJkWt");

#[program]
pub mod metahook {
    use super::*;

    /// Creates the ExtraAccountMetaList PDA for a Token-2022 mint and writes
    /// the V1 child-policy slots (allowlist, sanctions). Token-2022 reads this
    /// PDA on every transfer to discover the extra accounts the hook needs.
    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        let extra_metas = vec![
            ExtraAccountMeta::new_with_pubkey(&POLICY_ALLOWLIST_ID, false, false)?,
            ExtraAccountMeta::new_with_pubkey(&POLICY_SANCTIONS_ID, false, false)?,
        ];

        let account_size = ExtraAccountMetaList::size_of(extra_metas.len())?;
        let lamports = Rent::get()?.minimum_balance(account_size);

        let mint_key = ctx.accounts.mint.key();
        let bump = ctx.bumps.extra_account_meta_list;
        let signer_seeds: &[&[&[u8]]] =
            &[&[b"extra-account-metas", mint_key.as_ref(), &[bump]]];

        system_program::create_account(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::CreateAccount {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.extra_account_meta_list.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            lamports,
            account_size as u64,
            &crate::ID,
        )?;

        let mut data = ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?;
        ExtraAccountMetaList::init::<ExecuteInstruction>(&mut data, &extra_metas)?;
        Ok(())
    }

    /// Fallback handler for the SPL transfer-hook discriminators that Anchor
    /// doesn't dispatch automatically (Execute is invoked by Token-2022 itself).
    pub fn fallback<'info>(
        program_id: &Pubkey,
        accounts: &'info [AccountInfo<'info>],
        data: &[u8],
    ) -> Result<()> {
        let instruction =
            TransferHookInstruction::unpack(data).map_err(|_| ProgramError::InvalidInstructionData)?;
        match instruction {
            TransferHookInstruction::Execute { amount } => {
                process_execute(program_id, accounts, amount)
            }
            _ => Err(ProgramError::InvalidInstructionData.into()),
        }
    }
}

/// Token-2022 invokes this on every transfer. Account order from the SPL
/// transfer-hook spec:
///   0: source_token (readonly)
///   1: mint (readonly)
///   2: destination_token (readonly)
///   3: owner (readonly)
///   4: extra_account_meta_list (readonly)
///   5..: extra accounts in the order declared at init (V1: allowlist_program, sanctions_program)
fn process_execute<'info>(
    _program_id: &Pubkey,
    accounts: &'info [AccountInfo<'info>],
    amount: u64,
) -> Result<()> {
    require!(accounts.len() >= 5, MetaHookError::TooFewAccounts);

    let source = &accounts[0];
    let mint = &accounts[1];
    let destination = &accounts[2];
    let _owner = &accounts[3];

    msg!(
        "metahook: execute mint={} src={} dst={} amount={}",
        mint.key(),
        source.key(),
        destination.key(),
        amount
    );
    msg!("metahook: child CPIs delegated in Task 1.5");
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: PDA created here via system_program CPI; seeds enforced.
    #[account(
        mut,
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        bump,
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum MetaHookError {
    #[msg("Transfer hook called with too few accounts")]
    TooFewAccounts,
}
