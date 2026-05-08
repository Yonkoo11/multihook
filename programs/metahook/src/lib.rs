use anchor_lang::prelude::*;

declare_id!("4o6hRdZFqeM1YbvXQhjsmMgrNuoZSmgqMkpmZELBLh9d");

/// MetaHook — composes multiple Token-2022 transfer-hook child policies.
///
/// V1: hardcoded child list `[allowlist, sanctions]` with AND aggregation.
/// V2: dynamic ChildPolicyList account + Aggregation::{And,Or,Weighted}.
#[program]
pub mod metahook {
    use super::*;

    pub fn ping(_ctx: Context<Ping>) -> Result<()> {
        msg!("metahook scaffold alive");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Ping {}
