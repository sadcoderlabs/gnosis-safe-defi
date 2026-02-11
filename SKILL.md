---
name: gnosis-safe-defi
description: Manage DeFi positions via Gnosis Safe multisig. Supports Aave V3, Spark, Lido, ERC4626 vaults (Fluid, Spark Savings), and Merkl rewards on Ethereum mainnet. Use when proposing DeFi transactions (supply, stake, deposit, claim) through a Safe.
---

# Gnosis Safe DeFi

Propose DeFi transactions to a Gnosis Safe multisig.

## Setup

1. Copy `config.example.json` → `config.json`
2. Add your Safe addresses
3. Set `SAFE_PROPOSER_KEY` env var (or specify in config)
4. Run `bun install`

## Quick Reference

```bash
cd skills/gnosis-safe-defi

# Read balances
bun run scripts/read.ts --safe 0x... --all

# Read Aave/Spark positions
bun run scripts/aave/positions.ts --safe 0x... --protocol aave

# Build supply tx (outputs JSON, doesn't propose)
bun run scripts/aave/build-supply.ts --safe 0x... --protocol aave --token USDC --amount all

# Build ERC4626 deposit
bun run scripts/erc4626/build-deposit.ts --safe 0x... --vault fUSDC --amount all

# Build Lido stake
bun run scripts/lido/build-stake.ts --safe 0x... --amount all

# Propose batch (dry run first)
bun run scripts/propose-batch.ts --safe 0x... --txs-file txs.json --dry-run
bun run scripts/propose-batch.ts --safe 0x... --txs-file txs.json
```

## Workflow

1. **Build** — Run `build-*.ts` scripts to generate transaction JSON
2. **Review** — Check the output transactions
3. **Propose** — Pipe to `propose-batch.ts` or save to file
4. **Sign** — Signers approve in Safe app
5. **Execute** — Once threshold reached, execute on-chain

## Supported Protocols

| Protocol | Action | Script |
|----------|--------|--------|
| Aave V3 | Supply | `aave/build-supply.ts` |
| Spark Lending | Supply | `aave/build-supply.ts --protocol spark` |
| Lido | Stake ETH | `lido/build-stake.ts` |
| Fluid | Deposit | `erc4626/build-deposit.ts --vault fUSDC` |
| Spark Savings | Deposit | `erc4626/build-deposit.ts --vault spUSDC` |

## Vaults

| Name | Protocol | Underlying |
|------|----------|------------|
| fUSDC | Fluid | USDC |
| fUSDT | Fluid | USDT |
| spUSDC | Spark Savings | USDC |
| spUSDT | Spark Savings | USDT |
| spETH | Spark Savings | WETH |
