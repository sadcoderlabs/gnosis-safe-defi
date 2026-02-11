import { parseArgs } from "util";
import { ethers } from "ethers";
import { resolveSafe, getProtocol } from "../lib/config";
import { LIDO_ABI } from "../lib/abi";

/**
 * Build ETH → stETH stake transaction.
 * Keeps 0.1 ETH reserve for gas.
 *
 * Usage:
 *   bun run lido/build-stake.ts --safe 0x... --amount 1.5
 *   bun run lido/build-stake.ts --safe 0x... --amount all
 */

const GAS_RESERVE = ethers.parseEther("0.1");

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    safe: { type: "string" },
    amount: { type: "string" },
  },
});

if (!values.safe || !values.amount) {
  console.error(JSON.stringify({
    success: false,
    error: "Missing required args",
    usage: "bun run lido/build-stake.ts --safe 0x... --amount 1.5|all",
  }));
  process.exit(1);
}

const safeConfig = resolveSafe(values.safe);
const lidoConfig = getProtocol("lido");

const provider = new ethers.JsonRpcProvider(safeConfig.rpcUrl);

// Determine amount
let amountRaw: bigint;
if (values.amount === "all") {
  const ethBalance = await provider.getBalance(safeConfig.safeAddress);
  if (ethBalance <= GAS_RESERVE) {
    console.error(JSON.stringify({
      success: false,
      error: `ETH balance (${ethers.formatEther(ethBalance)}) is <= gas reserve (${ethers.formatEther(GAS_RESERVE)})`,
    }));
    process.exit(1);
  }
  amountRaw = ethBalance - GAS_RESERVE;
} else {
  amountRaw = ethers.parseEther(values.amount);
}

// Build stake tx
const lidoInterface = new ethers.Interface(LIDO_ABI);
const txs = [
  {
    to: lidoConfig.stETH,
    value: amountRaw.toString(),
    data: lidoInterface.encodeFunctionData("submit", [ethers.ZeroAddress]),
    description: `Stake ${ethers.formatEther(amountRaw)} ETH → stETH via Lido`,
  },
];

console.log(JSON.stringify({
  success: true,
  safe: safeConfig.safeAddress,
  amount: ethers.formatEther(amountRaw),
  gasReserve: ethers.formatEther(GAS_RESERVE),
  transactions: txs,
}, null, 2));
