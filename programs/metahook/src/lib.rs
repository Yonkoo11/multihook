use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token_interface::Mint;
use spl_tlv_account_resolution::{account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList};
use spl_transfer_hook_interface::instruction::{ExecuteInstruction, TransferHookInstruction};

declare_id!("4o6hRdZFqeM1YbvXQhjsmMgrNuoZSmgqMkpmZELBLh9d");

/// V1 child policy program IDs (hardcoded; Phase 2 lifts to a config account).
pub const POLICY_ALLOWLIST_ID: Pubkey = pubkey!("GJHxobVdfywhTidD9u4EoYPGa9kBQVzEcZ7kDhVZehyn");
pub const POLICY_SANCTIONS_ID: Pubkey = pubkey!("5iz6WXUksBqCQTBVkKYdeWtRJYwMZWiofM9AvSQDJkWt");

/// Account-list slots Token-2022 hands the hook on every transfer:
///   0: source_token
///   1: mint
///   2: destination_token
///   3: owner
///   4: extra_account_meta_list
///   5: reentrancy_guard
///   6: allowlist_program
///   7: allowlist_pda
///   8: sanctions_program
///   9: sanctions_pda
const EXPECTED_ACCOUNTS_LEN: usize = 10;

#[program]
pub mod metahook {
    use super::*;

    /// One-time global setup: create the reentrancy-guard PDA.
    pub fn initialize_reentrancy_guard(ctx: Context<InitializeReentrancyGuard>) -> Result<()> {
        let guard = &mut ctx.accounts.reentrancy_guard;
        guard.in_progress = false;
        Ok(())
    }

    /// Per-mint setup: build the ExtraAccountMetaList PDA so Token-2022 knows
    /// to forward the reentrancy guard, both child policy program IDs, and
    /// both child policy PDAs to the hook on every transfer.
    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        let allowlist_authority = ctx.accounts.allowlist_authority.key();
        let sanctions_authority = ctx.accounts.sanctions_authority.key();

        let (allowlist_pda, _) = Pubkey::find_program_address(
            &[b"allowlist", allowlist_authority.as_ref()],
            &POLICY_ALLOWLIST_ID,
        );
        let (sanctions_pda, _) = Pubkey::find_program_address(
            &[b"ofac-list", sanctions_authority.as_ref()],
            &POLICY_SANCTIONS_ID,
        );
        let (reentrancy_guard, _) =
            Pubkey::find_program_address(&[b"reentrancy-guard"], &crate::ID);

        let extra_metas = vec![
            ExtraAccountMeta::new_with_pubkey(&reentrancy_guard, false, true)?, // writable
            ExtraAccountMeta::new_with_pubkey(&POLICY_ALLOWLIST_ID, false, false)?,
            ExtraAccountMeta::new_with_pubkey(&allowlist_pda, false, false)?,
            ExtraAccountMeta::new_with_pubkey(&POLICY_SANCTIONS_ID, false, false)?,
            ExtraAccountMeta::new_with_pubkey(&sanctions_pda, false, false)?,
        ];
        // silence unused-import warning when `seeds` isn't needed in V1 (still
        // re-exported for Phase 2 dynamic resolution).
        let _ = ExtraAccountMeta::new_with_seeds(&[Seed::Literal { bytes: vec![] }], false, false);

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
    /// doesn't dispatch automatically.
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

fn process_execute<'info>(
    _program_id: &Pubkey,
    accounts: &'info [AccountInfo<'info>],
    amount: u64,
) -> Result<()> {
    require!(
        accounts.len() >= EXPECTED_ACCOUNTS_LEN,
        MetaHookError::TooFewAccounts
    );

    let source = &accounts[0];
    let mint = &accounts[1];
    let destination = &accounts[2];
    let owner = &accounts[3];
    // accounts[4] = extra_account_meta_list (Token-2022 already validated)
    let reentrancy_guard = &accounts[5];
    let allowlist_program = &accounts[6];
    let allowlist_pda = &accounts[7];
    let sanctions_program = &accounts[8];
    let sanctions_pda = &accounts[9];

    require_keys_eq!(
        *allowlist_program.key,
        POLICY_ALLOWLIST_ID,
        MetaHookError::WrongChildProgram
    );
    require_keys_eq!(
        *sanctions_program.key,
        POLICY_SANCTIONS_ID,
        MetaHookError::WrongChildProgram
    );

    // Reentrancy guard: must be uninitialized-or-false on entry.
    {
        let mut guard_data = reentrancy_guard.try_borrow_mut_data()?;
        require!(
            guard_data.len() >= 9,
            MetaHookError::ReentrancyGuardUninitialized
        );
        // anchor account layout: [8-byte discriminator, then state]
        let in_progress_byte = guard_data[8];
        require!(in_progress_byte == 0, MetaHookError::ReentrancyDetected);
        guard_data[8] = 1;
    }

    msg!(
        "metahook: execute mint={} src={} dst={} amount={}",
        mint.key(),
        source.key(),
        destination.key(),
        amount
    );

    // Aggregate AND: child #1 must succeed before #2 runs; either failure aborts.
    let allowlist_pass = invoke_child_check(
        allowlist_program,
        &[source, mint, destination, owner, allowlist_pda],
        amount,
        policy_allowlist::instruction::CheckTransfer::DISCRIMINATOR,
    )
    .is_ok();

    let sanctions_pass = if allowlist_pass {
        invoke_child_check(
            sanctions_program,
            &[source, mint, destination, owner, sanctions_pda],
            amount,
            policy_sanctions_ofac::instruction::CheckTransfer::DISCRIMINATOR,
        )
        .is_ok()
    } else {
        false
    };

    // Release the guard before returning. Solana commits state only on Ok, so
    // on a revert path this write is rolled back — that's fine because the
    // entire transaction aborts and no follow-up call can see the dirty flag.
    {
        let mut guard_data = reentrancy_guard.try_borrow_mut_data()?;
        guard_data[8] = 0;
    }

    let final_decision = allowlist_pass && sanctions_pass;

    emit!(MetaHookAuditEvent {
        mint: mint.key(),
        source: source.key(),
        destination: destination.key(),
        amount,
        allowlist_pass,
        sanctions_pass,
        final_decision,
    });

    require!(final_decision, MetaHookError::PolicyRejected);
    Ok(())
}

#[event]
pub struct MetaHookAuditEvent {
    pub mint: Pubkey,
    pub source: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
    pub allowlist_pass: bool,
    pub sanctions_pass: bool,
    pub final_decision: bool,
}

fn invoke_child_check<'info>(
    program: &AccountInfo<'info>,
    accounts: &[&AccountInfo<'info>],
    amount: u64,
    discriminator: &[u8],
) -> Result<()> {
    use anchor_lang::solana_program::{instruction::AccountMeta, instruction::Instruction, program::invoke};

    let mut data = Vec::with_capacity(discriminator.len() + 8);
    data.extend_from_slice(discriminator);
    data.extend_from_slice(&amount.to_le_bytes());

    let metas: Vec<AccountMeta> = accounts
        .iter()
        .map(|a| AccountMeta {
            pubkey: *a.key,
            is_signer: a.is_signer,
            is_writable: a.is_writable,
        })
        .collect();

    let ix = Instruction {
        program_id: *program.key,
        accounts: metas,
        data,
    };

    let infos: Vec<AccountInfo<'info>> = accounts
        .iter()
        .map(|a| (*a).clone())
        .chain(std::iter::once(program.clone()))
        .collect();

    invoke(&ix, &infos)?;
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeReentrancyGuard<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + 1,
        seeds = [b"reentrancy-guard"],
        bump,
    )]
    pub reentrancy_guard: Account<'info, ReentrancyGuard>,

    pub system_program: Program<'info, System>,
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

    /// CHECK: pubkey used to derive the allowlist PDA; not dereffed here.
    pub allowlist_authority: UncheckedAccount<'info>,

    /// CHECK: pubkey used to derive the sanctions PDA; not dereffed here.
    pub sanctions_authority: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct ReentrancyGuard {
    pub in_progress: bool,
}

#[error_code]
pub enum MetaHookError {
    #[msg("Transfer hook called with too few accounts")]
    TooFewAccounts,
    #[msg("Reentrancy detected: hook re-entered while in flight")]
    ReentrancyDetected,
    #[msg("Reentrancy guard PDA not initialized — call initialize_reentrancy_guard first")]
    ReentrancyGuardUninitialized,
    #[msg("Child policy program key did not match the configured V1 program ID")]
    WrongChildProgram,
    #[msg("Transfer rejected: at least one child policy returned a failure")]
    PolicyRejected,
}
