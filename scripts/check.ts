import { parseArgs } from "util";
import { SafeClient } from "./lib/safe-client";
import { resolveSafe, getProposerKey } from "./lib/config";

/**
 * Check signature status of a Safe transaction.
 *
 * Usage:
 *   bun run check.ts --safe 0x... --tx-hash 0x...
 */

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    safe: { type: "string" },
    "tx-hash": { type: "string" },
  },
});

if (!values.safe || !values["tx-hash"]) {
  console.error(JSON.stringify({
    success: false,
    error: "Missing --safe or --tx-hash",
    usage: "bun run check.ts --safe 0x... --tx-hash 0x...",
  }));
  process.exit(1);
}

const config = resolveSafe(values.safe);
const client = new SafeClient({
  safeAddress: config.safeAddress,
  chainId: config.chainId,
  rpcUrl: config.rpcUrl,
});

// Need to init with a key to read owners
const proposerKey = getProposerKey();
await client.init(proposerKey);

const status = await client.checkSignatureStatus(values["tx-hash"]);

console.log(JSON.stringify({
  success: true,
  safeTxHash: values["tx-hash"],
  ...status,
}, null, 2));
