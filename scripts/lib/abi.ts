// Common ABI fragments for DeFi interactions

export const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

export const ERC4626_ABI = [
  "function asset() view returns (address)",
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function convertToShares(uint256 assets) view returns (uint256)",
  "function maxDeposit(address) view returns (uint256)",
  "function maxRedeem(address) view returns (uint256)",
  "function previewRedeem(uint256 shares) view returns (uint256)",
  "function totalAssets() view returns (uint256)",
];

export const AAVE_POOL_ABI = [
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
  "function withdraw(address asset, uint256 amount, address to) returns (uint256)",
  "function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
];

export const AAVE_DATA_PROVIDER_ABI = [
  "function getUserReserveData(address asset, address user) view returns (uint256 currentATokenBalance, uint256 currentStableDebtTokenBalance, uint256 currentVariableDebtTokenBalance, uint256 principalStableDebtTokenBalance, uint256 scaledVariableDebtTokenBalance, uint256 stableBorrowRate, uint256 liquidityRate, uint40 stableRateLastUpdated, bool usageAsCollateralEnabled)",
  "function getAllReservesTokens() view returns (tuple(string symbol, address tokenAddress)[])",
  "function getReserveTokensAddresses(address asset) view returns (address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress)",
];

export const AAVE_REWARDS_ABI = [
  "function claimAllRewards(address[] assets, address to) returns (address[] rewardsList, uint256[] claimedAmounts)",
  "function getAllUserRewards(address[] assets, address user) view returns (address[] rewardsList, uint256[] unclaimedAmounts)",
];

export const LIDO_ABI = [
  "function submit(address referral) payable returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

export const WSTETH_ABI = [
  "function wrap(uint256 stETHAmount) returns (uint256)",
  "function unwrap(uint256 wstETHAmount) returns (uint256)",
  "function getStETHByWstETH(uint256 wstETHAmount) view returns (uint256)",
  "function getWstETHByStETH(uint256 stETHAmount) view returns (uint256)",
];

export const STK_GHO_ABI = [
  "function stake(address to, uint256 amount)",
  "function redeem(address to, uint256 amount)",
  "function cooldown()",
  "function claimRewards(address to, uint256 amount)",
  "function getTotalRewardsBalance(address staker) view returns (uint256)",
  "function stakersCooldowns(address staker) view returns (uint40 timestamp, uint216 amount)",
  "function COOLDOWN_SECONDS() view returns (uint256)",
  "function UNSTAKE_WINDOW() view returns (uint256)",
];

export const MERKL_DISTRIBUTOR_ABI = [
  "function claim(address[] users, address[] tokens, uint256[] amounts, bytes32[][] proofs)",
];
