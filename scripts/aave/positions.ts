import { parseArgs } from "util";
import { ethers } from "ethers";
import { resolveSafe, defaults, getProtocol } from "../lib/config";
import { AAVE_POOL_ABI, AAVE_DATA_PROVIDER_ABI, AAVE_REWARDS_ABI, ERC20_ABI } from "../lib/abi";

/**
 * Read Aave V3 / Spark positions for a Safe.
 *
 * Usage:
 *   bun run aave/positions.ts --safe 0x... --protocol aave
 *   bun run aave/positions.ts --safe 0x... --protocol spark
 */

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    safe: { type: "string" },
    protocol: { type: "string" },
  },
});

if (!values.safe || !values.protocol) {
  console.error(JSON.stringify({
    success: false,
    error: "Missing --safe or --protocol",
    usage: "bun run aave/positions.ts --safe 0x... --protocol aave|spark",
  }));
  process.exit(1);
}

const safeConfig = resolveSafe(values.safe);
const protocolConfig = getProtocol(values.protocol);
const provider = new ethers.JsonRpcProvider(safeConfig.rpcUrl);

const dataProvider = new ethers.Contract(protocolConfig.poolDataProvider, AAVE_DATA_PROVIDER_ABI, provider);
const pool = new ethers.Contract(protocolConfig.pool, AAVE_POOL_ABI, provider);
const rewardsController = new ethers.Contract(protocolConfig.rewardsController, AAVE_REWARDS_ABI, provider);

// Get all reserve tokens
const reserveTokens = await dataProvider.getAllReservesTokens();

interface Position {
  symbol: string;
  asset: string;
  aTokenBalance: string;
  stableDebt: string;
  variableDebt: string;
  usageAsCollateral: boolean;
}

const positions: Position[] = [];
const aTokens: string[] = [];

for (const [symbol, tokenAddress] of reserveTokens) {
  const [
    aTokenBalance,
    stableDebt,
    variableDebt,
    _,
    __,
    ___,
    ____,
    _____,
    usageAsCollateral,
  ] = await dataProvider.getUserReserveData(tokenAddress, safeConfig.safeAddress);

  if (aTokenBalance > 0n || stableDebt > 0n || variableDebt > 0n) {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const decimals = await tokenContract.decimals();

    // Get aToken address for rewards
    const [aTokenAddress] = await dataProvider.getReserveTokensAddresses(tokenAddress);
    aTokens.push(aTokenAddress);

    positions.push({
      symbol,
      asset: tokenAddress,
      aTokenBalance: ethers.formatUnits(aTokenBalance, decimals),
      stableDebt: ethers.formatUnits(stableDebt, decimals),
      variableDebt: ethers.formatUnits(variableDebt, decimals),
      usageAsCollateral,
    });
  }
}

// Get account data
const [
  totalCollateralBase,
  totalDebtBase,
  availableBorrowsBase,
  currentLiquidationThreshold,
  ltv,
  healthFactor,
] = await pool.getUserAccountData(safeConfig.safeAddress);

// Get rewards (if any aTokens)
interface Reward {
  token: string;
  symbol: string;
  amount: string;
}
const rewards: Reward[] = [];

if (aTokens.length > 0) {
  try {
    const [rewardsList, unclaimedAmounts] = await rewardsController.getAllUserRewards(
      aTokens,
      safeConfig.safeAddress
    );

    for (let i = 0; i < rewardsList.length; i++) {
      if (unclaimedAmounts[i] > 0n) {
        const rewardToken = new ethers.Contract(rewardsList[i], ERC20_ABI, provider);
        const decimals = await rewardToken.decimals();
        const symbol = await rewardToken.symbol();
        rewards.push({
          token: rewardsList[i],
          symbol,
          amount: ethers.formatUnits(unclaimedAmounts[i], decimals),
        });
      }
    }
  } catch (e) {
    // some protocols don't have rewards
  }
}

console.log(JSON.stringify({
  success: true,
  safe: safeConfig.safeAddress,
  protocol: values.protocol,
  positions,
  accountData: {
    totalCollateralUSD: ethers.formatUnits(totalCollateralBase, 8),
    totalDebtUSD: ethers.formatUnits(totalDebtBase, 8),
    availableBorrowsUSD: ethers.formatUnits(availableBorrowsBase, 8),
    healthFactor: healthFactor > 0n ? ethers.formatUnits(healthFactor, 18) : "∞",
  },
  rewards,
}, null, 2));
