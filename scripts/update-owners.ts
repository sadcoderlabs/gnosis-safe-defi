import { parseArgs } from "util";
import { ethers } from "ethers";
import { SafeClient } from "./lib/safe-client";
import { resolveSafe, availableSafes, getProposerKey } from "./lib/config";

/**
 * Update Safe owners (add/remove/swap) and optionally change threshold.
 *
 * Usage:
 *   bun run update-owners.ts --safe 0x... --owners "0x...,0x..." --threshold 3
 *   bun run update-owners.ts --safe 0x... --owners "0x...,0x..." --dry-run
 */

const SAFE_ABI = [
  "function addOwnerWithThreshold(address owner, uint256 _threshold)",
  "function removeOwner(address prevOwner, address owner, uint256 _threshold)",
  "function swapOwner(address prevOwner, address oldOwner, address newOwner)",
];

const SENTINEL = "0x0000000000000000000000000000000000000001";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    safe: { type: "string" },
    owners: { type: "string" },
    threshold: { type: "string" },
    nonce: { type: "string" },
    "dry-run": { type: "boolean" },
  },
});

if (!values.safe || !values.owners) {
  console.error(JSON.stringify({
    success: false,
    error: "Missing required arguments",
    usage: 'bun run update-owners.ts --safe 0x... --owners "0x...,0x..." [--threshold 3] [--dry-run]',
    availableSafes: availableSafes(),
  }));
  process.exit(1);
}

const config = resolveSafe(values.safe);
const targetOwners = values.owners.split(",").map(a => ethers.getAddress(a.trim()));
const dryRun = values["dry-run"] || false;

// Validate no duplicates
const uniqueTargets = new Set(targetOwners.map(a => a.toLowerCase()));
if (uniqueTargets.size !== targetOwners.length) {
  console.error(JSON.stringify({ success: false, error: "Duplicate addresses in target owners" }));
  process.exit(1);
}

// Initialize client
const client = new SafeClient({
  safeAddress: config.safeAddress,
  chainId: config.chainId,
  rpcUrl: config.rpcUrl,
});

if (!dryRun) {
  const proposerKey = getProposerKey();
  await client.init(proposerKey);
}

// Get current state
const provider = new ethers.JsonRpcProvider(config.rpcUrl);

// We need to read owners directly since client may not be initialized in dry-run
import Safe from "@safe-global/protocol-kit";
const readKit = await Safe.init({
  provider: config.rpcUrl,
  safeAddress: config.safeAddress,
});

const currentOwners = await readKit.getOwners();
const currentThreshold = await readKit.getThreshold();
const newThreshold = values.threshold ? parseInt(values.threshold, 10) : currentThreshold;

// Calculate diff
const currentSet = new Set(currentOwners.map(a => a.toLowerCase()));
const targetSet = new Set(targetOwners.map(a => a.toLowerCase()));

const toAdd = targetOwners.filter(a => !currentSet.has(a.toLowerCase()));
const toRemove = currentOwners.filter(a => !targetSet.has(a.toLowerCase()));

if (toAdd.length === 0 && toRemove.length === 0 && newThreshold === currentThreshold) {
  console.log(JSON.stringify({
    success: true,
    message: "Owners already match target. No changes needed.",
    currentOwners,
    threshold: currentThreshold,
  }, null, 2));
  process.exit(0);
}

// Build transactions
const safeInterface = new ethers.Interface(SAFE_ABI);
const transactions: { to: string; value: string; data: string; description: string }[] = [];
let simulatedOwners = [...currentOwners];

function findPrevOwner(owners: string[], target: string): string {
  const idx = owners.findIndex(o => o.toLowerCase() === target.toLowerCase());
  if (idx === -1) throw new Error(`Owner ${target} not found`);
  return idx === 0 ? SENTINEL : owners[idx - 1];
}

// Phase 1: Swap (pair add+remove)
const swapPairs = Math.min(toAdd.length, toRemove.length);
for (let i = 0; i < swapPairs; i++) {
  const oldOwner = toRemove[i];
  const newOwner = toAdd[i];
  const prevOwner = findPrevOwner(simulatedOwners, oldOwner);

  transactions.push({
    to: config.safeAddress,
    value: "0",
    data: safeInterface.encodeFunctionData("swapOwner", [prevOwner, oldOwner, newOwner]),
    description: `Swap ${oldOwner.slice(0,10)}... → ${newOwner.slice(0,10)}...`,
  });

  const idx = simulatedOwners.findIndex(o => o.toLowerCase() === oldOwner.toLowerCase());
  simulatedOwners[idx] = newOwner;
}

// Phase 2: Add remaining
for (let i = swapPairs; i < toAdd.length; i++) {
  const intermediateThreshold = Math.min(newThreshold, simulatedOwners.length + 1);
  transactions.push({
    to: config.safeAddress,
    value: "0",
    data: safeInterface.encodeFunctionData("addOwnerWithThreshold", [toAdd[i], intermediateThreshold]),
    description: `Add owner ${toAdd[i].slice(0,10)}... (threshold: ${intermediateThreshold})`,
  });
  simulatedOwners.push(toAdd[i]);
}

// Phase 3: Remove remaining
for (let i = swapPairs; i < toRemove.length; i++) {
  const isLast = i === toRemove.length - 1 && toAdd.length <= swapPairs;
  const intermediateThreshold = isLast ? newThreshold : Math.min(newThreshold, simulatedOwners.length - 1);
  const prevOwner = findPrevOwner(simulatedOwners, toRemove[i]);

  transactions.push({
    to: config.safeAddress,
    value: "0",
    data: safeInterface.encodeFunctionData("removeOwner", [prevOwner, toRemove[i], intermediateThreshold]),
    description: `Remove owner ${toRemove[i].slice(0,10)}... (threshold: ${intermediateThreshold})`,
  });

  const idx = simulatedOwners.findIndex(o => o.toLowerCase() === toRemove[i].toLowerCase());
  simulatedOwners.splice(idx, 1);
}

const plan = {
  safe: config.safeAddress,
  currentOwners,
  currentThreshold,
  targetOwners,
  newThreshold,
  toAdd,
  toRemove,
  transactions: transactions.map(t => t.description),
};

if (dryRun) {
  console.log(JSON.stringify({ success: true, dryRun: true, plan }, null, 2));
  process.exit(0);
}

// Propose
const customNonce = values.nonce ? parseInt(values.nonce, 10) : undefined;
const result = await client.proposeBatchTx(transactions, customNonce);

console.log(JSON.stringify({
  success: true,
  plan,
  safeTxHash: result.safeTxHash,
  safeAppUrl: result.safeAppUrl,
  nonce: result.nonce,
}, null, 2));
