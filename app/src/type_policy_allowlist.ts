/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/policy_allowlist.json`.
 */
export type PolicyAllowlist = {
  "address": "GJHxobVdfywhTidD9u4EoYPGa9kBQVzEcZ7kDhVZehyn",
  "metadata": {
    "name": "policyAllowlist",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Allowlist child policy for MetaHook"
  },
  "docs": [
    "policy-allowlist — child policy that approves a transfer only when the",
    "destination owner appears in the allowlist account."
  ],
  "instructions": [
    {
      "name": "addAllowed",
      "discriminator": [
        249,
        43,
        102,
        160,
        98,
        236,
        59,
        208
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "allowlist"
          ]
        },
        {
          "name": "allowlist",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  108,
                  108,
                  111,
                  119,
                  108,
                  105,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "addr",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "checkTransfer",
      "docs": [
        "MetaHook CPIs into this. Account order matches the SPL transfer-hook",
        "account convention (source, mint, destination, owner) plus the",
        "allowlist PDA at the tail."
      ],
      "discriminator": [
        181,
        98,
        3,
        219,
        143,
        70,
        25,
        215
      ],
      "accounts": [
        {
          "name": "sourceToken"
        },
        {
          "name": "mint"
        },
        {
          "name": "destinationToken"
        },
        {
          "name": "owner"
        },
        {
          "name": "allowlist"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initialize",
      "docs": [
        "Create the allowlist PDA. `authority` becomes the only key that can",
        "add or remove addresses afterwards."
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "allowlist",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  108,
                  108,
                  111,
                  119,
                  108,
                  105,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "authority"
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
    },
    {
      "name": "removeAllowed",
      "discriminator": [
        73,
        255,
        50,
        107,
        212,
        112,
        72,
        87
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "allowlist"
          ]
        },
        {
          "name": "allowlist",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  108,
                  108,
                  111,
                  119,
                  108,
                  105,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "addr",
          "type": "pubkey"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "allowlist",
      "discriminator": [
        188,
        77,
        210,
        114,
        13,
        206,
        20,
        47
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "destinationNotAllowed",
      "msg": "policy.allowlist.fail: destination not on allowlist"
    },
    {
      "code": 6001,
      "name": "listFull",
      "msg": "Allowlist is full (V1 cap = 32)"
    },
    {
      "code": 6002,
      "name": "unauthorized",
      "msg": "Caller is not the allowlist authority"
    },
    {
      "code": 6003,
      "name": "tokenAccountTooSmall",
      "msg": "Token account data too small to read owner"
    }
  ],
  "types": [
    {
      "name": "allowlist",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "entries",
            "type": {
              "vec": "pubkey"
            }
          }
        ]
      }
    }
  ]
};
