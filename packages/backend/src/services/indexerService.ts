import prisma from '../models/db';
import { Direction } from '@prisma/client';

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

  return market;
};

export const handleStakePlaced = async (data: any) => {
  const { positionId, marketId, userAddress, targetValueX, isYes, tokensMinted, stakeAmount } = data;

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

  // Upsert Position
  await prisma.position.upsert({
    where: { positionId },
    update: {
      tokensMinted: { increment: tokensMinted },
      stakeAmount: { increment: netStake },
    },
    create: {
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

  return updatedMarket;
};
