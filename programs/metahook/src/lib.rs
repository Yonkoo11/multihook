use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token_interface::Mint;
use spl_tlv_account_resolution::{account::ExtraAccountMeta, state::ExtraAccountMetaList};
use spl_transfer_hook_interface::instruction::{ExecuteInstruction, TransferHookInstruction};

declare_id!("4o6hRdZFqeM1YbvXQhjsmMgrNuoZSmgqMkpmZELBLh9d");

/// V1 hard cap on the number of child policies a single MetaHookConfig can
/// compose. Picked so the per-transfer CU budget stays within Token-2022's
/// 200K limit (each child CPI costs ~5-20K CU; 8 policies ≈ 40-160K CU).
/// Increase by changing the constant + reallocing the config PDA.
pub const MAX_POLICIES: usize = 8;

/// Account-list slots Token-2022 hands the hook on every transfer:
///   0..3:  source_token, mint, destination_token, owner    (Token-2022 fixed)
///   4:     extra_account_meta_list                         (Token-2022 fixed)
///   5:     metahook config PDA                             (we read first)
///   6:     reentrancy_guard                                (we write)
///   7..N:  interleaved (policy_program, policy_pda) pairs  (one per active policy)
const FIXED_ACCOUNTS_BEFORE_POLICIES: usize = 7;

/// V1 supports AND aggregation only. V2 will add OR, weighted, k-of-n.
#[repr(u8)]
#[derive(Clone, Copy, PartialEq, Eq, AnchorSerialize, AnchorDeserialize)]
pub enum Aggregation {
    And = 0,
    // Or = 1,         // V2 reserved
    // Weighted = 2,   // V2 reserved
}

/// One configured child policy: program ID + the policy state PDA derived
/// from the issuer's authority. We store both so the meta-hook does not need
/// to re-derive (different policies use different PDA seeds).
#[derive(Clone, Copy, PartialEq, Eq, AnchorSerialize, AnchorDeserialize, Default, InitSpace)]
pub struct PolicyEntry {
    pub program_id: Pubkey,
    pub policy_pda: Pubkey,
}

#[program]
pub mod metahook {
    use super::*;

    /// One-time global setup: create the reentrancy-guard PDA. Called once
    /// per metahook deployment (not per mint).
    pub fn initialize_reentrancy_guard(ctx: Context<InitializeReentrancyGuard>) -> Result<()> {
        let guard = &mut ctx.accounts.reentrancy_guard;
        guard.in_progress = false;
        Ok(())
    }

    /// Per-mint compliance config. Set once at mint creation; the meta-hook
    /// reads it on every transfer to know which child policies to CPI into.
    /// `authority` is the only key allowed to modify it later.
    ///
    /// `policies` carries up to 8 (program_id, policy_pda) entries. The
    /// caller is responsible for deriving each policy_pda correctly — the
    /// canonical seed pattern is `[<policy-name>, authority]` per
    /// POLICY_INTERFACE.md, but policies may use any seeds they choose.
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        policies: Vec<PolicyEntry>,
        aggregation: u8,
    ) -> Result<()> {
        require!(
            policies.len() > 0 && policies.len() <= MAX_POLICIES,
            MetaHookError::InvalidPolicyCount
        );
        require!(aggregation == Aggregation::And as u8, MetaHookError::UnsupportedAggregation);

        let config = &mut ctx.accounts.config;
        config.version = 1;
        config.authority = ctx.accounts.authority.key();
        config.mint = ctx.accounts.mint.key();
        config.aggregation = aggregation;
        config.policy_count = policies.len() as u8;
        config.policies = [PolicyEntry::default(); MAX_POLICIES];
        for (i, p) in policies.iter().enumerate() {
            config.policies[i] = *p;
        }
        Ok(())
    }

    /// Build the ExtraAccountMetaList PDA. Reads the per-mint MetaHookConfig
    /// to discover which (program_id, policy_pda) pairs to forward, then
    /// emits the canonical ordering Token-2022 uses to populate
    /// transfer-hook account contexts.
    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        let policy_count = config.policy_count as usize;
        require!(policy_count > 0 && policy_count <= MAX_POLICIES, MetaHookError::InvalidPolicyCount);

        let (config_pda, _) = Pubkey::find_program_address(
            &[b"metahook-config", ctx.accounts.mint.key().as_ref()],
            &crate::ID,
        );
        let (reentrancy_guard, _) =
            Pubkey::find_program_address(&[b"reentrancy-guard"], &crate::ID);

        // Emit list in the order process_execute expects to read:
        //   [config, reentrancy_guard, (program_0, pda_0), (program_1, pda_1), ...]
        let mut extra_metas: Vec<ExtraAccountMeta> = Vec::with_capacity(2 + 2 * policy_count);
        extra_metas.push(ExtraAccountMeta::new_with_pubkey(&config_pda, false, false)?);
        extra_metas.push(ExtraAccountMeta::new_with_pubkey(&reentrancy_guard, false, true)?); // writable
        for i in 0..policy_count {
            let p = &config.policies[i];
            extra_metas.push(ExtraAccountMeta::new_with_pubkey(&p.program_id, false, false)?);
            extra_metas.push(ExtraAccountMeta::new_with_pubkey(&p.policy_pda, false, false)?);
        }

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

    /// Add a new policy to an existing config. Authority-gated.
    /// Note: changing the policy set REQUIRES re-initializing the
    /// ExtraAccountMetaList for the mint (size + ordering changes).
    /// Phase 2 will add a `realloc_extra_account_meta_list` ix; for V1 the
    /// issuer must close+recreate via off-chain tooling.
    pub fn add_policy(ctx: Context<MutateConfig>, policy: PolicyEntry) -> Result<()> {
        let config = &mut ctx.accounts.config;
        let count = config.policy_count as usize;
        require!(count < MAX_POLICIES, MetaHookError::PolicyListFull);
        // dedupe by program_id
        for i in 0..count {
            require!(config.policies[i].program_id != policy.program_id, MetaHookError::PolicyAlreadyConfigured);
        }
        config.policies[count] = policy;
        config.policy_count = (count as u8) + 1;
        Ok(())
    }

    /// Remove a policy by program_id.
    pub fn remove_policy(ctx: Context<MutateConfig>, program_id: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;
        let count = config.policy_count as usize;
        let mut found = None;
        for i in 0..count {
            if config.policies[i].program_id == program_id {
                found = Some(i);
                break;
            }
        }
        let idx = found.ok_or(error!(MetaHookError::PolicyNotConfigured))?;
        // shift left
        for i in idx..(count - 1) {
            config.policies[i] = config.policies[i + 1];
        }
        config.policies[count - 1] = PolicyEntry::default();
        config.policy_count -= 1;
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
        accounts.len() >= FIXED_ACCOUNTS_BEFORE_POLICIES,
        MetaHookError::TooFewAccounts
    );

    let source = &accounts[0];
    let mint = &accounts[1];
    let destination = &accounts[2];
    let owner = &accounts[3];
    // accounts[4] = extra_account_meta_list (Token-2022 already validated)
    let config_account = &accounts[5];
    let reentrancy_guard = &accounts[6];

    // Verify config account is for THIS mint and is owned by us.
    require_keys_eq!(*config_account.owner, crate::ID, MetaHookError::ConfigOwnerMismatch);
    let config = MetaHookConfig::try_deserialize(&mut &**config_account.try_borrow_data()?)?;
    require_keys_eq!(config.mint, mint.key(), MetaHookError::ConfigMintMismatch);
    let policy_count = config.policy_count as usize;
    require!(policy_count > 0 && policy_count <= MAX_POLICIES, MetaHookError::InvalidPolicyCount);
    require!(
        accounts.len() >= FIXED_ACCOUNTS_BEFORE_POLICIES + 2 * policy_count,
        MetaHookError::TooFewAccounts
    );

    // Validate every (program_id, policy_pda) pair against config.
    for i in 0..policy_count {
        let prog_idx = FIXED_ACCOUNTS_BEFORE_POLICIES + 2 * i;
        let pda_idx = prog_idx + 1;
        let configured = &config.policies[i];
        require_keys_eq!(*accounts[prog_idx].key, configured.program_id, MetaHookError::PolicyProgramMismatch);
        require_keys_eq!(*accounts[pda_idx].key, configured.policy_pda, MetaHookError::PolicyPdaMismatch);
    }

    // Reentrancy guard: byte at offset 8 must be 0 on entry; flip to 1.
    {
        let mut guard_data = reentrancy_guard.try_borrow_mut_data()?;
        require!(guard_data.len() >= 9, MetaHookError::ReentrancyGuardUninitialized);
        require!(guard_data[8] == 0, MetaHookError::ReentrancyDetected);
        guard_data[8] = 1;
    }

    msg!(
        "metahook: execute mint={} src={} dst={} amount={} policies={}",
        mint.key(), source.key(), destination.key(), amount, policy_count
    );

    // AND-aggregate: short-circuit on first failure. Track which policy failed
    // (if any) for the audit event.
    let mut failed_policy_index: i8 = -1;
    // Anchor instruction discriminator for `check_transfer` is the first 8
    // bytes of sha256("global:check_transfer"). Hardcoded to avoid pulling
    // sha2 into BPF bytecode for a single fixed preimage. Verified via:
    //   python3 -c 'import hashlib; print(list(hashlib.sha256(b"global:check_transfer").digest()[:8]))'
    // → [181, 98, 3, 219, 143, 70, 25, 215]
    // All Anchor child policies expose check_transfer with this discriminator.
    // Non-Anchor policies must mimic the same dispatch convention.
    const CHECK_TRANSFER_DISC: [u8; 8] = [0xb5, 0x62, 0x03, 0xdb, 0x8f, 0x46, 0x19, 0xd7];
    let discriminator: &[u8] = &CHECK_TRANSFER_DISC;

    for i in 0..policy_count {
        let prog_idx = FIXED_ACCOUNTS_BEFORE_POLICIES + 2 * i;
        let pda_idx = prog_idx + 1;
        let program = &accounts[prog_idx];
        let policy_pda = &accounts[pda_idx];
        let result = invoke_child_check(
            program,
            &[source, mint, destination, owner, policy_pda],
            amount,
            &discriminator,
        );
        if result.is_err() {
            failed_policy_index = i as i8;
            break;
        }
    }

    // Release the guard before returning. Solana commits state only on Ok, so
    // on a revert path this write is rolled back — that's fine because the
    // entire transaction aborts and no follow-up call can see the dirty flag.
    {
        let mut guard_data = reentrancy_guard.try_borrow_mut_data()?;
        guard_data[8] = 0;
    }

    let final_decision = failed_policy_index < 0;

    msg!(
        "MetaHookAuditEvent: final={} failed_policy={}",
        final_decision, failed_policy_index
    );

    emit!(MetaHookAuditEvent {
        version: 1,
        mint: mint.key(),
        source: source.key(),
        destination: destination.key(),
        amount,
        policy_count: policy_count as u8,
        final_decision,
        failed_policy_index,
    });

    require!(final_decision, MetaHookError::PolicyRejected);
    Ok(())
}

#[event]
pub struct MetaHookAuditEvent {
    pub version: u8,
    pub mint: Pubkey,
    pub source: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
    pub policy_count: u8,
    pub final_decision: bool,
    /// Index into `MetaHookConfig.policies` of the FIRST policy that failed.
    /// `-1` when `final_decision == true`.
    pub failed_policy_index: i8,
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

// ---- Account contexts ----

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
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = authority,
        space = 8 + MetaHookConfig::INIT_SPACE,
        seeds = [b"metahook-config", mint.key().as_ref()],
        bump,
    )]
    pub config: Account<'info, MetaHookConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MutateConfig<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority @ MetaHookError::Unauthorized,
        seeds = [b"metahook-config", config.mint.as_ref()],
        bump,
    )]
    pub config: Account<'info, MetaHookConfig>,
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

    #[account(
        seeds = [b"metahook-config", mint.key().as_ref()],
        bump,
    )]
    pub config: Account<'info, MetaHookConfig>,

    pub system_program: Program<'info, System>,
}

// ---- Account state ----

#[account]
pub struct ReentrancyGuard {
    pub in_progress: bool,
}

#[account]
#[derive(InitSpace)]
pub struct MetaHookConfig {
    pub version: u8,
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub aggregation: u8,
    pub policy_count: u8,
    pub policies: [PolicyEntry; MAX_POLICIES],
}

#[error_code]
pub enum MetaHookError {
    #[msg("Transfer hook called with too few accounts")]
    TooFewAccounts,
    #[msg("Reentrancy detected: hook re-entered while in flight")]
    ReentrancyDetected,
    #[msg("Reentrancy guard PDA not initialized — call initialize_reentrancy_guard first")]
    ReentrancyGuardUninitialized,
    #[msg("Config policy_count is 0 or exceeds MAX_POLICIES")]
    InvalidPolicyCount,
    #[msg("Aggregation mode not supported in V1 (only AND=0)")]
    UnsupportedAggregation,
    #[msg("Config account is not owned by the MetaHook program")]
    ConfigOwnerMismatch,
    #[msg("Config.mint does not match the transfer's mint")]
    ConfigMintMismatch,
    #[msg("Account-list policy program ID does not match the configured entry")]
    PolicyProgramMismatch,
    #[msg("Account-list policy PDA does not match the configured entry")]
    PolicyPdaMismatch,
    #[msg("Policy list is full (V1 cap = MAX_POLICIES)")]
    PolicyListFull,
    #[msg("Policy is already in the config")]
    PolicyAlreadyConfigured,
    #[msg("Policy is not in the config")]
    PolicyNotConfigured,
    #[msg("Caller is not the config authority")]
    Unauthorized,
    #[msg("Transfer rejected: at least one child policy returned a failure")]
    PolicyRejected,
}
