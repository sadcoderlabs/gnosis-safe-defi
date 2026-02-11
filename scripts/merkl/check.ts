import { parseArgs } from "util";
import { ethers } from "ethers";
import { resolveSafe, getProtocol, defaults } from "../lib/config";

/**
 * Check claimable Merkl rewards for a Safe.
 *
 * Usage:
 *   bun run merkl/check.ts --safe 0x...
 */

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    safe: { type: "string" },
  },
});

if (!values.safe) {
  console.error(JSON.stringify({
    success: false,
    error: "Missing --safe",
    usage: "bun run merkl/check.ts --safe 0x...",
  }));
  process.exit(1);
}

const safeConfig = resolveSafe(values.safe);
const merklConfig = getProtocol("merkl");

// Fetch from Merkl API
const url = `${merklConfig.api}/v4/users/${safeConfig.safeAddress}?chainId=${safeConfig.chainId}`;
const response = await fetch(url);

if (!response.ok) {
  console.error(JSON.stringify({
    success: false,
    error: `Merkl API error: ${response.status}`,
  }));
  process.exit(1);
}

const data = await response.json();

interface Reward {
  token: string;
  symbol: string;
  unclaimed: string;
  accumulated: string;
}

const rewards: Reward[] = [];

for (const [token, info] of Object.entries(data as any)) {
  const i = info as any;
  if (i.unclaimed && BigInt(i.unclaimed) > 0n) {
    rewards.push({
      token,
      symbol: i.symbol || "?",
      unclaimed: ethers.formatUnits(i.unclaimed, i.decimals || 18),
      accumulated: ethers.formatUnits(i.accumulated || "0", i.decimals || 18),
    });
  }
}

console.log(JSON.stringify({
  success: true,
  safe: safeConfig.safeAddress,
  rewards,
  distributor: merklConfig.distributor,
}, null, 2));
