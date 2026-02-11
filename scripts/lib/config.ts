import { existsSync } from "fs";
import { join, dirname } from "path";

const skillRoot = join(dirname(import.meta.path), "../..");

// Load defaults (protocol addresses - always present)
const defaultsPath = join(skillRoot, "defaults.json");
export const defaults = JSON.parse(await Bun.file(defaultsPath).text());

// Load user config (safe addresses - user must create)
const configPath = join(skillRoot, "config.json");
let userConfig: any = { safes: {} };

if (existsSync(configPath)) {
  userConfig = JSON.parse(await Bun.file(configPath).text());
}

export interface SafeConfig {
  safeAddress: string;
  chainId: number;
  rpcUrl: string;
}

/**
 * Resolve a safe name or address to config
 */
export function resolveSafe(safeNameOrAddress: string): SafeConfig {
  // If it's already an address, use it directly
  if (safeNameOrAddress.startsWith("0x") && safeNameOrAddress.length === 42) {
    return {
      safeAddress: safeNameOrAddress,
      chainId: userConfig.chainId || defaults.chainId,
      rpcUrl: userConfig.rpcUrl || defaults.rpcUrl,
    };
  }

  // Look up by name
  const safeEntry = userConfig.safes?.[safeNameOrAddress];
  if (!safeEntry) {
    console.error(JSON.stringify({
      success: false,
      error: `Safe '${safeNameOrAddress}' not found`,
      hint: "Use a 0x address directly, or add to config.json",
      availableSafes: Object.keys(userConfig.safes || {}),
    }));
    process.exit(1);
  }

  return {
    safeAddress: safeEntry.safeAddress,
    chainId: userConfig.chainId || defaults.chainId,
    rpcUrl: userConfig.rpcUrl || defaults.rpcUrl,
  };
}

export function availableSafes(): string[] {
  return Object.keys(userConfig.safes || {});
}

export function getToken(symbol: string) {
  const token = defaults.tokens[symbol];
  if (!token) {
    throw new Error(`Unknown token: ${symbol}. Available: ${Object.keys(defaults.tokens).join(", ")}`);
  }
  return token;
}

export function getProtocol(name: string) {
  const protocol = defaults.protocols[name];
  if (!protocol) {
    throw new Error(`Unknown protocol: ${name}. Available: ${Object.keys(defaults.protocols).join(", ")}`);
  }
  return protocol;
}

export function getVault(name: string) {
  const vault = defaults.vaults[name];
  if (!vault) {
    throw new Error(`Unknown vault: ${name}. Available: ${Object.keys(defaults.vaults).join(", ")}`);
  }
  return vault;
}

/**
 * Get proposer private key from env var
 */
export function getProposerKey(): string {
  const envVar = userConfig.proposerKeyEnv || "SAFE_PROPOSER_KEY";
  const key = process.env[envVar];
  if (!key) {
    throw new Error(`Proposer key not found. Set ${envVar} environment variable.`);
  }
  return key;
}
