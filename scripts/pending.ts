import { parseArgs } from "util";
import { SafeClient } from "./lib/safe-client";
import { resolveSafe, getProposerKey } from "./lib/config";

/**
 * List pending transactions for a Safe.
 *
 * Usage:
 *   bun run pending.ts --safe 0x...
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
    usage: "bun run pending.ts --safe 0x...",
  }));
  process.exit(1);
}

const config = resolveSafe(values.safe);
const client = new SafeClient({
  safeAddress: config.safeAddress,
  chainId: config.chainId,
  rpcUrl: config.rpcUrl,
});

const proposerKey = getProposerKey();
await client.init(proposerKey);

const result = await client.getPendingTransactions();

console.log(JSON.stringify({
  success: true,
  safe: config.safeAddress,
  ...result,
}, null, 2));
