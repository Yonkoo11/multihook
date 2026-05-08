use anchor_lang::prelude::*;

declare_id!("GJHxobVdfywhTidD9u4EoYPGa9kBQVzEcZ7kDhVZehyn");

/// policy-allowlist — child policy that approves transfers only when
/// destination is on a maintained allowlist account.
#[program]
pub mod policy_allowlist {
    use super::*;

    pub fn ping(_ctx: Context<Ping>) -> Result<()> {
        msg!("policy-allowlist scaffold alive");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Ping {}
