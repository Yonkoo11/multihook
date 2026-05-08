use anchor_lang::prelude::*;

declare_id!("5iz6WXUksBqCQTBVkKYdeWtRJYwMZWiofM9AvSQDJkWt");

/// policy-sanctions-ofac — child policy that rejects transfers when
/// destination is on a sanctioned-addresses list (inverted allowlist).
#[program]
pub mod policy_sanctions_ofac {
    use super::*;

    pub fn ping(_ctx: Context<Ping>) -> Result<()> {
        msg!("policy-sanctions-ofac scaffold alive");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Ping {}
