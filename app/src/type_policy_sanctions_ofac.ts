/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/policy_sanctions_ofac.json`.
 */
export type PolicySanctionsOfac = {
  "address": "5iz6WXUksBqCQTBVkKYdeWtRJYwMZWiofM9AvSQDJkWt",
  "metadata": {
    "name": "policySanctionsOfac",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "OFAC sanctions list child policy for MetaHook"
  },
  "docs": [
    "policy-sanctions-ofac — child policy that REJECTS a transfer when the",
    "destination owner appears in the sanctioned-addresses list.",
    "Inverted shape vs. policy-allowlist."
  ],
  "instructions": [
    {
      "name": "addSanctioned",
      "discriminator": [
        75,
        210,
        173,
        223,
        16,
        178,
        233,
        65
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "ofacList"
          ]
        },
        {
          "name": "ofacList",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  102,
                  97,
                  99,
                  45,
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
          "name": "ofacList"
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
          "name": "ofacList",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  102,
                  97,
                  99,
                  45,
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
      "name": "removeSanctioned",
      "discriminator": [
        150,
        163,
        156,
        7,
        81,
        234,
        244,
        202
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "ofacList"
          ]
        },
        {
          "name": "ofacList",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  102,
                  97,
                  99,
                  45,
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
      "name": "ofacList",
      "discriminator": [
        237,
        77,
        76,
        90,
        234,
        64,
        36,
        201
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "destinationSanctioned",
      "msg": "policy.sanctions.fail: destination is sanctioned"
    },
    {
      "code": 6001,
      "name": "listFull",
      "msg": "OFAC list is full (V1 cap = 64)"
    },
    {
      "code": 6002,
      "name": "unauthorized",
      "msg": "Caller is not the OFAC list authority"
    },
    {
      "code": 6003,
      "name": "tokenAccountTooSmall",
      "msg": "Token account data too small to read owner"
    }
  ],
  "types": [
    {
      "name": "ofacList",
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
