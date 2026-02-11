import { parseArgs } from "util";
import { ethers } from "ethers";
import { resolveSafe, defaults, getToken, getVault } from "./lib/config";
import { ERC20_ABI, ERC4626_ABI } from "./lib/abi";

/**
 * Read Safe balances: ETH + ERC20 tokens + ERC4626 vault positions
 *
 * Usage:
 *   bun run read.ts --safe 0x...
 *   bun run read.ts --safe 0x... --tokens USDC,USDT
 *   bun run read.ts --safe 0x... --vault fUSDC
 */

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    safe: { type: "string" },
    tokens: { type: "string" },
    vault: { type: "string" },
    all: { type: "boolean" },
  },
});

if (!values.safe) {
  console.error(JSON.stringify({
    success: false,
    error: "Missing --safe",
    usage: "bun run read.ts --safe 0x... [--tokens USDC,USDT] [--vault fUSDC] [--all]",
  }));
  process.exit(1);
}

const config = resolveSafe(values.safe);
const provider = new ethers.JsonRpcProvider(config.rpcUrl);

interface Balance {
  symbol: string;
  balance: string;
  raw: string;
  decimals: number;
}

interface VaultPosition {
  vault: string;
  shares: string;
  assets: string;
  underlying: string;
  protocol: string;
}

const result: {
  safe: string;
  eth: string;
  tokens: Balance[];
  vaults: VaultPosition[];
} = {
  safe: config.safeAddress,
  eth: "0",
  tokens: [],
  vaults: [],
};

// Read ETH balance
const ethBalance = await provider.getBalance(config.safeAddress);
result.eth = ethers.formatEther(ethBalance);

// Determine which tokens to read
let tokenSymbols: string[];
if (values.all) {
  tokenSymbols = Object.keys(defaults.tokens);
} else if (values.tokens) {
  tokenSymbols = values.tokens.split(",").map((s) => s.trim());
} else {
  tokenSymbols = ["USDC", "USDT", "WETH"]; // defaults
}

// Read ERC20 balances
for (const symbol of tokenSymbols) {
  try {
    const token = getToken(symbol);
    const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
    const balance = await contract.balanceOf(config.safeAddress);
    result.tokens.push({
      symbol,
      balance: ethers.formatUnits(balance, token.decimals),
      raw: balance.toString(),
      decimals: token.decimals,
    });
  } catch (e: any) {
    console.error(`Error reading ${symbol}: ${e.message}`);
  }
}

// Read vault position if specified
if (values.vault) {
  const vaultConfig = getVault(values.vault);
  const vaultContract = new ethers.Contract(vaultConfig.address, ERC4626_ABI, provider);
  const shares = await vaultContract.balanceOf(config.safeAddress);
  const assets = shares > 0n ? await vaultContract.convertToAssets(shares) : 0n;
  const underlying = getToken(vaultConfig.underlying);

  result.vaults.push({
    vault: values.vault,
    shares: ethers.formatUnits(shares, underlying.decimals),
    assets: ethers.formatUnits(assets, underlying.decimals),
    underlying: vaultConfig.underlying,
    protocol: vaultConfig.protocol,
  });
}

// Read all vaults if --all
if (values.all) {
  for (const [name, vaultConfig] of Object.entries(defaults.vaults)) {
    if (values.vault === name) continue; // already read
    try {
      const vaultContract = new ethers.Contract((vaultConfig as any).address, ERC4626_ABI, provider);
      const shares = await vaultContract.balanceOf(config.safeAddress);
      if (shares > 0n) {
        const assets = await vaultContract.convertToAssets(shares);
        const underlying = getToken((vaultConfig as any).underlying);
        result.vaults.push({
          vault: name,
          shares: ethers.formatUnits(shares, underlying.decimals),
          assets: ethers.formatUnits(assets, underlying.decimals),
          underlying: (vaultConfig as any).underlying,
          protocol: (vaultConfig as any).protocol,
        });
      }
    } catch (e) {
      // skip
    }
  }
}

console.log(JSON.stringify({ success: true, ...result }, null, 2));
