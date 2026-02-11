import { parseArgs } from "util";
import { SafeClient } from "./lib/safe-client";
import { resolveSafe, getProposerKey } from "./lib/config";

/**
 * Execute a fully-signed Safe transaction.
 *
 * Usage:
 *   bun run execute.ts --safe 0x... --tx-hash 0x...
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
    usage: "bun run execute.ts --safe 0x... --tx-hash 0x...",
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

// Check if executable first
const status = await client.checkSignatureStatus(values["tx-hash"]);
if (status.isExecuted) {
  console.log(JSON.stringify({
    success: true,
    message: "Transaction already executed",
    transactionHash: status.transactionHash,
  }, null, 2));
  process.exit(0);
}

if (!status.isExecutable) {
  console.error(JSON.stringify({
    success: false,
    error: `Not enough signatures (${status.confirmations}/${status.threshold})`,
    pendingOwners: status.pendingOwners,
  }));
  process.exit(1);
}

const txHash = await client.executeTransaction(values["tx-hash"]);

console.log(JSON.stringify({
  success: true,
  safeTxHash: values["tx-hash"],
  transactionHash: txHash,
  etherscanUrl: `https://etherscan.io/tx/${txHash}`,
}, null, 2));
