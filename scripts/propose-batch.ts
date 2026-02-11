import { parseArgs } from "util";
import { SafeClient, type SafeTxItem } from "./lib/safe-client";
import { resolveSafe, availableSafes, getProposerKey } from "./lib/config";

/**
 * Propose a batch of arbitrary transactions to a Safe.
 *
 * Usage:
 *   bun run propose-batch.ts --safe 0x... --txs '[{"to":"0x...","value":"0","data":"0x..."}]'
 *   bun run propose-batch.ts --safe 0x... --txs-file /path/to/txs.json
 *   bun run propose-batch.ts --safe 0x... --txs '[...]' --dry-run
 */

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    safe: { type: "string" },
    txs: { type: "string" },
    "txs-file": { type: "string" },
    nonce: { type: "string" },
    "dry-run": { type: "boolean" },
  },
});

if (!values.safe) {
  console.error(JSON.stringify({
    success: false,
    error: "Missing --safe",
    usage: 'bun run propose-batch.ts --safe 0x... --txs \'[{"to":"0x...","value":"0","data":"0x..."}]\'',
    availableSafes: availableSafes(),
  }));
  process.exit(1);
}

if (!values.txs && !values["txs-file"]) {
  console.error(JSON.stringify({
    success: false,
    error: "Missing --txs or --txs-file",
  }));
  process.exit(1);
}

const config = resolveSafe(values.safe);

// Parse transactions
let txs: SafeTxItem[];
try {
  if (values["txs-file"]) {
    const content = await Bun.file(values["txs-file"]).text();
    txs = JSON.parse(content);
  } else {
    txs = JSON.parse(values.txs!);
  }
} catch (e: any) {
  console.error(JSON.stringify({
    success: false,
    error: `Invalid JSON: ${e.message}`,
  }));
  process.exit(1);
}

if (!Array.isArray(txs) || txs.length === 0) {
  console.error(JSON.stringify({
    success: false,
    error: "txs must be a non-empty array",
  }));
  process.exit(1);
}

// Validate each tx
for (let i = 0; i < txs.length; i++) {
  const tx = txs[i];
  if (!tx.to || !tx.data) {
    console.error(JSON.stringify({
      success: false,
      error: `Transaction ${i} missing required fields (to, data)`,
    }));
    process.exit(1);
  }
  tx.value = tx.value || "0";
}

// Dry run: just print the transactions
if (values["dry-run"]) {
  console.log(JSON.stringify({
    success: true,
    dryRun: true,
    safe: config.safeAddress,
    transactionCount: txs.length,
    transactions: txs.map((tx, i) => ({
      index: i,
      to: tx.to,
      value: tx.value,
      dataLength: tx.data.length,
      description: tx.description || undefined,
    })),
  }, null, 2));
  process.exit(0);
}

// Get proposer key
const proposerKey = getProposerKey();

// Initialize client and propose
const client = new SafeClient({
  safeAddress: config.safeAddress,
  chainId: config.chainId,
  rpcUrl: config.rpcUrl,
});

await client.init(proposerKey);

const customNonce = values.nonce ? parseInt(values.nonce, 10) : undefined;
const result = await client.proposeBatchTx(txs, customNonce);

console.log(JSON.stringify({
  success: true,
  safeTxHash: result.safeTxHash,
  safeAppUrl: result.safeAppUrl,
  nonce: result.nonce,
  transactionCount: txs.length,
  owners: result.owners,
}, null, 2));
