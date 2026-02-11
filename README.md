# Gnosis Safe DeFi

An AgentSkill for AI coding agents (Claude Code, OpenClaw, Codex, etc.) to manage DeFi positions via Gnosis Safe multisig wallets. The agent reads on-chain state, builds transactions, gets human confirmation, and proposes batched operations to the Safe.

## What is an AgentSkill?

This is **not a CLI tool** — it's a skill package designed to be used by AI agents with shell access. The agent:

1. Receives natural language instructions (e.g., "deposit all USDC to Aave on Treasury")
2. Runs the scripts to read state and build transactions
3. Presents a plan for human review
4. Proposes to Safe after confirmation

## Supported Protocols

| Protocol | Type | Actions |
|----------|------|---------|
| **Aave V3** | Lending | Supply, Withdraw, Claim Rewards |
| **Spark Lending** | Lending (Aave fork) | Supply, Withdraw, Claim Rewards |
| **Spark Savings** | ERC-4626 Vaults | Deposit, Withdraw |
| **Fluid** | ERC-4626 Vaults | Deposit, Withdraw |
| **Lido** | Liquid Staking | Stake ETH → stETH, Wrap → wstETH |
| **Merkl** | Rewards | Check & Claim |

## Installation

```bash
# As a git submodule in your agent workspace
git submodule add https://github.com/anthropics/gnosis-safe-defi.git skills/gnosis-safe-defi

# Install dependencies
cd skills/gnosis-safe-defi
bun install

# Configure
cp config.example.json config.json
# Edit config.json with your Safe addresses
```

## Configuration

### config.json

```json
{
  "safes": {
    "Treasury": { "safeAddress": "0x..." },
    "Operations": { "safeAddress": "0x..." }
  },
  "proposerKeyEnv": "SAFE_PROPOSER_KEY",
  "rpcUrl": "https://eth.drpc.org"
}
```

### Environment Variables

```bash
# Required: Private key of an address that can propose to the Safe
# (doesn't need to be an owner, just needs to be a delegate or proposer)
export SAFE_PROPOSER_KEY="0x..."

# Or use 1Password CLI
export SAFE_PROPOSER_KEY=$(op read "op://vault/item/field")
```

## Scripts Reference

### Reading Positions

```bash
# Check all token balances
bun run scripts/read.ts --safe Treasury --all

# Check Aave positions
bun run scripts/aave/positions.ts --safe Treasury --protocol aave

# Check Spark Lending positions
bun run scripts/aave/positions.ts --safe Treasury --protocol spark

# Check Merkl rewards
bun run scripts/merkl/check.ts --safe Treasury
```

### Building Transactions

Build scripts generate transaction JSON without proposing. The agent presents these for human review.

```bash
# Aave/Spark Lending - Supply
bun run scripts/aave/build-supply.ts \
  --safe Treasury \
  --protocol aave \
  --token USDC \
  --amount 1000        # or "all" for entire balance

# ERC-4626 Vaults - Deposit
bun run scripts/erc4626/build-deposit.ts \
  --safe Treasury \
  --vault fUSDC \      # fUSDC, fUSDT, spUSDC, spUSDT, spETH
  --amount all

# Lido - Stake ETH
bun run scripts/lido/build-stake.ts \
  --safe Treasury \
  --amount 10          # ETH amount, or "all"
```

### Proposing Transactions

```bash
# From file (after human approval)
bun run scripts/propose-batch.ts \
  --safe Treasury \
  --txs-file transactions.json

# Dry run (validate without proposing)
bun run scripts/propose-batch.ts \
  --safe Treasury \
  --txs-file transactions.json \
  --dry-run
```

### Safe Management

```bash
# List pending transactions
bun run scripts/pending.ts --safe Treasury

# Check transaction status
bun run scripts/check.ts --safe Treasury --tx-hash 0x...

# Execute a fully-signed transaction
bun run scripts/execute.ts --safe Treasury --tx-hash 0x...

# Update owners/threshold
bun run scripts/update-owners.ts \
  --safe Treasury \
  --owners "0xA...,0xB...,0xC..." \
  --threshold 2 \
  --dry-run
```

## Agent Workflow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────┐     ┌─────────┐
│ User asks   │ ──▶ │ Agent reads │ ──▶ │ Agent builds│ ──▶ │ Human   │ ──▶ │ Agent   │
│ "deposit X" │     │ on-chain    │     │ & presents  │     │ confirms│     │ proposes│
└─────────────┘     └─────────────┘     └─────────────┘     └─────────┘     └─────────┘
                                                                                  │
                                                                                  ▼
                                                            ┌─────────┐     ┌─────────┐
                                                            │ Execute │ ◀── │ Owners  │
                                                            │ on-chain│     │ sign    │
                                                            └─────────┘     └─────────┘
```

1. **User Request**: Natural language instruction via chat
2. **Read State**: Agent runs read scripts to check balances/positions
3. **Build & Present**: Agent generates transactions and explains the plan
4. **Human Confirmation**: User reviews and approves
5. **Propose**: Agent submits to Safe Transaction Service
6. **Sign**: Owners approve in [Safe App](https://app.safe.global)
7. **Execute**: Once threshold is met, execute on-chain

## ERC-4626 Vaults

The skill supports any ERC-4626 compliant vault. Pre-configured vaults:

| Vault | Address | Protocol | Underlying |
|-------|---------|----------|------------|
| fUSDC | `0x9Fb7b4477576Fe5B32be4C1843aFB1e55F251B33` | Fluid | USDC |
| fUSDT | `0x5C20B550819128074FD538Edf79791733ccEdd18` | Fluid | USDT |
| spUSDC | `0x28B3a8fb53B741A8Fd78c0fb9A6B2393d896a43d` | Spark Savings V2 | USDC |
| spUSDT | `0xe2e7a17dFf93280dec073C995595155283e3C372` | Spark Savings V2 | USDT |
| spETH | `0xfE6eb3b609a7C8352A241f7F3A21CEA4e9209B8f` | Spark Savings V2 | WETH |

Add custom vaults in `defaults.json`:

```json
{
  "vaults": {
    "myVault": {
      "address": "0x...",
      "protocol": "custom",
      "underlying": "USDC"
    }
  }
}
```

## Protocol Addresses (Ethereum Mainnet)

### Aave V3
- Pool: `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`
- Rewards Controller: `0x8164Cc65827dcFe994AB23944CBC90e0aa80bFcb`

### Spark Lending
- Pool: `0xC13e21B648A5Ee794902342038FF3aDAB66BE987`
- Rewards Controller: `0x4370D3b6C9588E02ce9D22e684387859c7Ff5b34`

### Lido
- stETH: `0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84`
- wstETH: `0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0`
- Withdrawal Queue: `0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1`

### Merkl
- Distributor: `0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae`

## Security Considerations

- **Review all transactions** before proposing. The build scripts output human-readable descriptions.
- **Use dry-run mode** (`--dry-run`) to validate transactions without submitting.
- **Proposer key** only needs permission to propose, not execute. Keep owner keys separate.
- **Multi-sig threshold** ensures no single party can execute transactions.
- **Test on Staging Safe** first before using with production funds.

## Contributing

1. Fork the repository
2. Add your protocol in `scripts/<protocol>/`
3. Update `defaults.json` with contract addresses
4. Submit a pull request

## License

MIT
