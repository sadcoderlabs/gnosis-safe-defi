import { parseArgs } from "util";
import { ethers } from "ethers";
import { resolveSafe, getVault, getToken } from "../lib/config";
import { ERC20_ABI, ERC4626_ABI } from "../lib/abi";

/**
 * Build approve + deposit transactions for ERC4626 vaults.
 *
 * Usage:
 *   bun run erc4626/build-deposit.ts --safe 0x... --vault fUSDC --amount 1000
 *   bun run erc4626/build-deposit.ts --safe 0x... --vault spUSDT --amount all
 */

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    safe: { type: "string" },
    vault: { type: "string" },
    amount: { type: "string" },
  },
});

if (!values.safe || !values.vault || !values.amount) {
  console.error(JSON.stringify({
    success: false,
    error: "Missing required args",
    usage: "bun run erc4626/build-deposit.ts --safe 0x... --vault fUSDC|spUSDC --amount 1000|all",
  }));
  process.exit(1);
}

const safeConfig = resolveSafe(values.safe);
const vaultConfig = getVault(values.vault);
const underlyingConfig = getToken(vaultConfig.underlying);

const provider = new ethers.JsonRpcProvider(safeConfig.rpcUrl);
const underlyingContract = new ethers.Contract(underlyingConfig.address, ERC20_ABI, provider);

// Determine amount
let amountRaw: bigint;
if (values.amount === "all") {
  amountRaw = await underlyingContract.balanceOf(safeConfig.safeAddress);
  if (amountRaw === 0n) {
    console.error(JSON.stringify({
      success: false,
      error: `No ${vaultConfig.underlying} balance in Safe`,
    }));
    process.exit(1);
  }
} else {
  amountRaw = ethers.parseUnits(values.amount, underlyingConfig.decimals);
}

// Check current allowance
const currentAllowance = await underlyingContract.allowance(safeConfig.safeAddress, vaultConfig.address);

// Build transactions
const txs: { to: string; value: string; data: string; description: string }[] = [];
const erc20Interface = new ethers.Interface(ERC20_ABI);
const vaultInterface = new ethers.Interface(ERC4626_ABI);

// Add approve if needed
if (currentAllowance < amountRaw) {
  txs.push({
    to: underlyingConfig.address,
    value: "0",
    data: erc20Interface.encodeFunctionData("approve", [vaultConfig.address, amountRaw]),
    description: `Approve ${ethers.formatUnits(amountRaw, underlyingConfig.decimals)} ${vaultConfig.underlying} for ${values.vault}`,
  });
}

// Add deposit
txs.push({
  to: vaultConfig.address,
  value: "0",
  data: vaultInterface.encodeFunctionData("deposit", [amountRaw, safeConfig.safeAddress]),
  description: `Deposit ${ethers.formatUnits(amountRaw, underlyingConfig.decimals)} ${vaultConfig.underlying} to ${values.vault}`,
});

console.log(JSON.stringify({
  success: true,
  safe: safeConfig.safeAddress,
  vault: values.vault,
  protocol: vaultConfig.protocol,
  underlying: vaultConfig.underlying,
  amount: ethers.formatUnits(amountRaw, underlyingConfig.decimals),
  transactions: txs,
}, null, 2));
