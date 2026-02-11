import { parseArgs } from "util";
import { ethers } from "ethers";
import { resolveSafe, getProtocol, getToken, defaults } from "../lib/config";
import { ERC20_ABI, AAVE_POOL_ABI } from "../lib/abi";

/**
 * Build approve + supply transactions for Aave V3 / Spark.
 *
 * Usage:
 *   bun run aave/build-supply.ts --safe 0x... --protocol aave --token USDC --amount 1000
 *   bun run aave/build-supply.ts --safe 0x... --protocol spark --token USDC --amount all
 */

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    safe: { type: "string" },
    protocol: { type: "string" },
    token: { type: "string" },
    amount: { type: "string" },
  },
});

if (!values.safe || !values.protocol || !values.token || !values.amount) {
  console.error(JSON.stringify({
    success: false,
    error: "Missing required args",
    usage: "bun run aave/build-supply.ts --safe 0x... --protocol aave|spark --token USDC --amount 1000|all",
  }));
  process.exit(1);
}

const safeConfig = resolveSafe(values.safe);
const protocolConfig = getProtocol(values.protocol);
const tokenConfig = getToken(values.token);

const provider = new ethers.JsonRpcProvider(safeConfig.rpcUrl);
const tokenContract = new ethers.Contract(tokenConfig.address, ERC20_ABI, provider);

// Determine amount
let amountRaw: bigint;
if (values.amount === "all") {
  amountRaw = await tokenContract.balanceOf(safeConfig.safeAddress);
  if (amountRaw === 0n) {
    console.error(JSON.stringify({
      success: false,
      error: `No ${values.token} balance in Safe`,
    }));
    process.exit(1);
  }
} else {
  amountRaw = ethers.parseUnits(values.amount, tokenConfig.decimals);
}

// Check current allowance
const currentAllowance = await tokenContract.allowance(safeConfig.safeAddress, protocolConfig.pool);

// Build transactions
const txs: { to: string; value: string; data: string; description: string }[] = [];
const erc20Interface = new ethers.Interface(ERC20_ABI);
const poolInterface = new ethers.Interface(AAVE_POOL_ABI);

// Add approve if needed
if (currentAllowance < amountRaw) {
  txs.push({
    to: tokenConfig.address,
    value: "0",
    data: erc20Interface.encodeFunctionData("approve", [protocolConfig.pool, amountRaw]),
    description: `Approve ${ethers.formatUnits(amountRaw, tokenConfig.decimals)} ${values.token} for ${values.protocol}`,
  });
}

// Add supply
txs.push({
  to: protocolConfig.pool,
  value: "0",
  data: poolInterface.encodeFunctionData("supply", [
    tokenConfig.address,
    amountRaw,
    safeConfig.safeAddress,
    0, // referral code
  ]),
  description: `Supply ${ethers.formatUnits(amountRaw, tokenConfig.decimals)} ${values.token} to ${values.protocol}`,
});

console.log(JSON.stringify({
  success: true,
  safe: safeConfig.safeAddress,
  protocol: values.protocol,
  token: values.token,
  amount: ethers.formatUnits(amountRaw, tokenConfig.decimals),
  transactions: txs,
}, null, 2));
