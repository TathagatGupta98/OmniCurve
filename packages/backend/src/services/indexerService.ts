import prisma from '../models/db';
import { Direction } from '@prisma/client';
import { broadcastMarketUpdate, broadcastMarketResolved } from '../sockets/socketManager';

export const handleLiquidityAdded = async (data: any) => {
  const { marketId, userAddress, newMu, newSigma, addedLiquidity } = data;

  const market = await prisma.market.update({
    where: { marketId },
    data: {
      currentMu: newMu,
      currentSigma: newSigma,
      totalLiquidity: { increment: addedLiquidity },
    },
  });

  await prisma.user.upsert({
    where: { walletAddress: userAddress },
    update: {
      totalLiquidityProvided: { increment: addedLiquidity },
    },
    create: {
      walletAddress: userAddress,
      totalLiquidityProvided: addedLiquidity,
      rolePreference: 'LP',
    },
  });

  broadcastMarketUpdate(marketId, {
    currentMu: market.currentMu,
    currentSigma: market.currentSigma,
    totalLiquidity: market.totalLiquidity,
  });

  return market;
};

export const handleStakePlaced = async (data: any) => {
  const { positionId, marketId, userAddress, targetValueX, isYes, tokensMinted, stakeAmount } = data;

  // Idempotency guard — if this positionId was already processed, skip to prevent
  // double-counting fees on webhook retry.
  const existing = await prisma.position.findUnique({ where: { positionId } });
  if (existing) {
    console.log(`[Idempotency] Position ${positionId} already exists — skipping duplicate webhook`);
    return prisma.market.findUnique({ where: { marketId } });
  }

  // Calculate 1% fee
  const fee = stakeAmount * 0.01;
  const netStake = stakeAmount - fee;

  const market = await prisma.market.findUnique({ where: { marketId } });
  if (!market) throw new Error(`Market not found: ${marketId}`);

  // Update the Global Accumulator: S = S + f/L
  const newAccumulator = market.totalLiquidity > 0
    ? market.globalAccumulator + (fee / market.totalLiquidity)
    : market.globalAccumulator;

  const updatedMarket = await prisma.market.update({
    where: { marketId },
    data: { globalAccumulator: newAccumulator },
  });

  const direction: Direction = isYes ? 'ABOVE' : 'BELOW';

  await prisma.position.create({
    data: {
      positionId,
      userAddress,
      marketId,
      targetValueX,
      direction,
      tokensMinted,
      stakeAmount: netStake,
    },
  });

  // Update User's globalAccumulatorSnapshot
  await prisma.user.upsert({
    where: { walletAddress: userAddress },
    update: {
      globalAccumulatorSnapshot: newAccumulator,
    },
    create: {
      walletAddress: userAddress,
      globalAccumulatorSnapshot: newAccumulator,
      rolePreference: 'STAKER',
    },
  });

  broadcastMarketUpdate(marketId, {
    currentMu: updatedMarket.currentMu,
    currentSigma: updatedMarket.currentSigma,
    totalLiquidity: updatedMarket.totalLiquidity,
  });

  return updatedMarket;
};

/**
 * Handles a MarketCreated event from the Factory via Goldsky webhook.
 * Upserts a new Market row with the deployed AMM/Router/LP Token proxy addresses.
 *
 * Expected payload: { marketId, ammAddress, routerAddress, lpTokenAddress, currentMu, currentSigma, sigmaMin }
 */
export const handleMarketCreated = async (data: any) => {
  const { marketId, ammAddress, routerAddress, lpTokenAddress, currentMu, currentSigma, sigmaMin } = data;

  const market = await prisma.market.upsert({
    where: { marketId: String(marketId) },
    update: {
      ammAddress,
      routerAddress,
      lpTokenAddress,
      currentMu: currentMu ?? 0,
      currentSigma: currentSigma ?? 0,
    },
    create: {
      marketId: String(marketId),
      title: `Market #${marketId}`,
      category: 'general',
      currentMu: currentMu ?? 0,
      currentSigma: currentSigma ?? 0,
      minVarianceBound: sigmaMin ?? 0,
      ammAddress: ammAddress ?? '',
      routerAddress: routerAddress ?? '',
      lpTokenAddress: lpTokenAddress ?? '',
    },
  });

  console.log(`[Goldsky] MarketCreated — upserted market ${marketId} (AMM: ${ammAddress})`);
  return market;
};

/**
 * Handles a MarketResolved event from the AMM via Goldsky webhook.
 * Sets isResolved=true, records winningTokenId, and broadcasts to Socket.io room.
 *
 * Expected payload: { marketId, winningTokenId }
 */
export const handleMarketResolved = async (data: any) => {
  const { marketId, winningTokenId } = data;

  const market = await prisma.market.update({
    where: { marketId: String(marketId) },
    data: {
      isResolved: true,
      winningTokenId: String(winningTokenId),
    },
  });

  broadcastMarketResolved(String(marketId), { winningTokenId: String(winningTokenId) });

  console.log(`[Goldsky] MarketResolved — market ${marketId}, winner: ${winningTokenId}`);
  return market;
};
