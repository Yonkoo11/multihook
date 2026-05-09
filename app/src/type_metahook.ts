/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/metahook.json`.
 */
export type Metahook = {
  "address": "4o6hRdZFqeM1YbvXQhjsmMgrNuoZSmgqMkpmZELBLh9d",
  "metadata": {
    "name": "metahook",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Meta transfer-hook for Token-2022: composes multiple child policy programs"
  },
  "instructions": [
    {
      "name": "initializeExtraAccountMetaList",
      "docs": [
        "Per-mint setup: build the ExtraAccountMetaList PDA so Token-2022 knows",
        "to forward the reentrancy guard, both child policy program IDs, and",
        "both child policy PDAs to the hook on every transfer."
      ],
      "discriminator": [
        92,
        197,
        174,
        197,
        41,
        124,
        19,
        3
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "extraAccountMetaList",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  116,
                  114,
                  97,
                  45,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  45,
                  109,
                  101,
                  116,
                  97,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "allowlistAuthority"
        },
        {
          "name": "sanctionsAuthority"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeReentrancyGuard",
      "docs": [
        "One-time global setup: create the reentrancy-guard PDA."
      ],
      "discriminator": [
        122,
        115,
        224,
        96,
        48,
        221,
        219,
        99
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "reentrancyGuard",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  101,
                  110,
                  116,
                  114,
                  97,
                  110,
                  99,
                  121,
                  45,
                  103,
                  117,
                  97,
                  114,
                  100
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "reentrancyGuard",
      "discriminator": [
        207,
        227,
        141,
        11,
        194,
        21,
        193,
        32
      ]
    }
  ],
  "events": [
    {
      "name": "metaHookAuditEvent",
      "discriminator": [
        212,
        7,
        92,
        54,
        249,
        97,
        146,
        65
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "tooFewAccounts",
      "msg": "Transfer hook called with too few accounts"
    },
    {
      "code": 6001,
      "name": "reentrancyDetected",
      "msg": "Reentrancy detected: hook re-entered while in flight"
    },
    {
      "code": 6002,
      "name": "reentrancyGuardUninitialized",
      "msg": "Reentrancy guard PDA not initialized — call initialize_reentrancy_guard first"
    },
    {
      "code": 6003,
      "name": "wrongChildProgram",
      "msg": "Child policy program key did not match the configured V1 program ID"
    },
    {
      "code": 6004,
      "name": "policyRejected",
      "msg": "Transfer rejected: at least one child policy returned a failure"
    }
  ],
  "types": [
    {
      "name": "metaHookAuditEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "source",
            "type": "pubkey"
          },
          {
            "name": "destination",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "allowlistPass",
            "type": "bool"
          },
          {
            "name": "sanctionsPass",
            "type": "bool"
          },
          {
            "name": "finalDecision",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "reentrancyGuard",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "inProgress",
            "type": "bool"
          }
        ]
      }
    }
  ]
};
