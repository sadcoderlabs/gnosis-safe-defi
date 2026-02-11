# Gnosis Safe DeFi

A CLI toolkit for proposing DeFi transactions to Gnosis Safe multisig wallets. Build, review, and propose complex DeFi operations as batched Safe transactions.

## Features

- **Multi-protocol support**: Aave V3, Spark (Lending & Savings), Lido, Fluid, and more
- **Batch transactions**: Combine multiple operations into a single Safe proposal
- **Read-only queries**: Check balances, positions, and pending rewards
- **Safe management**: Update owners, thresholds, and execute signed transactions
- **ERC-4626 compatible**: Works with any standard vault (Fluid, Spark Savings, etc.)

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
# Clone the repo
git clone https://github.com/anthropics/gnosis-safe-defi.git
cd gnosis-safe-defi

# Install dependencies
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

## Usage

### Reading Positions

```bash
# Check all token balances
bun run scripts/read.ts --safe 0x... --all

# Check Aave positions
bun run scripts/aave/positions.ts --safe 0x... --protocol aave

# Check Spark Lending positions
bun run scripts/aave/positions.ts --safe 0x... --protocol spark

# Check Merkl rewards
bun run scripts/merkl/check.ts --safe 0x...
```

### Building Transactions

Build scripts generate transaction JSON without proposing. Review before submitting.

```bash
# Aave/Spark Lending - Supply
bun run scripts/aave/build-supply.ts \
  --safe 0x... \
  --protocol aave \
  --token USDC \
  --amount 1000        # or "all" for entire balance

# ERC-4626 Vaults - Deposit
bun run scripts/erc4626/build-deposit.ts \
  --safe 0x... \
  --vault fUSDC \      # fUSDC, fUSDT, spUSDC, spUSDT, spETH
  --amount all

# Lido - Stake ETH
bun run scripts/lido/build-stake.ts \
  --safe 0x... \
  --amount 10          # ETH amount, or "all"
```

### Proposing Transactions

```bash
# From JSON array
bun run scripts/propose-batch.ts \
  --safe Treasury \
  --txs '[{"to":"0x...","value":"0","data":"0x..."}]'

# From file
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
bun run scripts/pending.ts --safe 0x...

# Check transaction status
bun run scripts/check.ts --safe 0x... --tx-hash 0x...

# Execute a fully-signed transaction
bun run scripts/execute.ts --safe 0x... --tx-hash 0x...

# Update owners/threshold
bun run scripts/update-owners.ts \
  --safe 0x... \
  --owners "0xA...,0xB...,0xC..." \
  --threshold 2 \
  --dry-run
```

## Workflow

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  Build  │ ──▶ │ Review  │ ──▶ │ Propose │ ──▶ │  Sign   │ ──▶ │ Execute │
└─────────┘     └─────────┘     └─────────┘     └─────────┘     └─────────┘
   CLI            Human          CLI/API        Safe App         CLI/App
```

1. **Build**: Run `build-*.ts` scripts to generate transaction calldata
2. **Review**: Inspect the output JSON, verify addresses and amounts
3. **Propose**: Submit to Safe Transaction Service via `propose-batch.ts`
4. **Sign**: Owners approve in [Safe App](https://app.safe.global)
5. **Execute**: Once threshold is met, execute on-chain

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
