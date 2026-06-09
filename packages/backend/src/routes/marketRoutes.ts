import { Router, Request, Response, NextFunction } from 'express';
import * as marketController from '../controllers/marketController';
import prisma from '../models/db';
import { calculatePricePreview } from '../services/mathService';
import {
  getMarketState,
  getLpTokenBalance,
  getAccFeePerShare,
  getRewardDebt,
  getAmmOwner,
  computePendingRewards,
} from '../services/chainService';

const router = Router();

// ─── Existing routes ─────────────────────────────────────────────────────────

router.get('/', marketController.getMarkets);
router.get('/:marketId', marketController.getMarketDetails);

// ─── Section 3: New routes ───────────────────────────────────────────────────

/**
 * GET /api/markets/:id/price?x=&direction=&stakeAmount=
 *
 * Price preview for the staker UI widget.
 * Returns expected YES/NO prices and fee breakdown.
 */
router.get('/:id/price', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const xParam = req.query.x ? String(req.query.x) : undefined;
    const direction = req.query.direction ? String(req.query.direction) : undefined;
    const stakeAmountParam = req.query.stakeAmount ? String(req.query.stakeAmount) : undefined;

    // Validate required params
    if (!xParam || isNaN(Number(xParam))) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "x" is required and must be a number',
      });
    }

    if (!direction || !['yes', 'no'].includes(direction)) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "direction" is required and must be "yes" or "no"',
      });
    }

    const market = await prisma.market.findUnique({ where: { marketId: id } });

    if (!market) {
      return res.status(404).json({ success: false, error: 'Market not found' });
    }

    const stakeAmount = stakeAmountParam ? Number(stakeAmountParam) : undefined;

    const preview = calculatePricePreview(
      Number(xParam),
      direction as 'yes' | 'no',
      market.currentMu,
      market.currentSigma,
      stakeAmount,
    );

    res.status(200).json({
      success: true,
      data: preview,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/markets/:id/lp-stats?address=
 *
 * Returns LP token balance, accumulated fees, and pending rewards
 * for a specific LP in a market. Reads on-chain data via viem.
 */
router.get('/:id/lp-stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const address = req.query.address ? String(req.query.address) : undefined;

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "address" is required and must be a valid Ethereum address',
      });
    }

    const market = await prisma.market.findUnique({ where: { marketId: id } });

    if (!market) {
      return res.status(404).json({ success: false, error: 'Market not found' });
    }

    if (!market.ammAddress) {
      return res.status(400).json({ success: false, error: 'Market has no AMM address configured' });
    }

    // Read on-chain LP data in parallel
    const [lpTokenBalance, accFeePerShare, rewardDebt] = await Promise.all([
      getLpTokenBalance(market.ammAddress, address),
      getAccFeePerShare(market.ammAddress),
      getRewardDebt(market.ammAddress, address),
    ]);

    const pendingRewards = computePendingRewards(lpTokenBalance, accFeePerShare, rewardDebt);

    res.status(200).json({
      success: true,
      data: {
        marketId: id,
        lpTokenBalance,
        accFeePerShare,
        rewardDebt,
        pendingRewards,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/markets/:id/settle
 *
 * Owner-only settlement preview. Reads globalMu from chain, determines
 * the winning token, and returns the result. Does NOT send an on-chain tx.
 *
 * Headers: x-owner-address (must match the AMM contract owner)
 * Body: { finalPrice: number }
 */
router.post('/:id/settle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const { finalPrice } = req.body;
    const ownerHeader = req.headers['x-owner-address'] ? String(req.headers['x-owner-address']) : undefined;

    if (finalPrice === undefined || typeof finalPrice !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Request body must include "finalPrice" as a number',
      });
    }

    const market = await prisma.market.findUnique({ where: { marketId: id } });

    if (!market) {
      return res.status(404).json({ success: false, error: 'Market not found' });
    }

    if (!market.ammAddress) {
      return res.status(400).json({ success: false, error: 'Market has no AMM address configured' });
    }

    // Owner authorization: compare header with on-chain owner
    const contractOwner = await getAmmOwner(market.ammAddress);

    if (
      !ownerHeader ||
      ownerHeader.toLowerCase() !== contractOwner.toLowerCase()
    ) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: x-owner-address header must match the AMM contract owner',
      });
    }

    // Read current mu from chain for authoritative value
    const state = await getMarketState(market.ammAddress);

    // Determine winning token: if finalPrice >= mu → YES (1), else NO (0)
    const winningTokenId = finalPrice >= state.mu ? '1' : '0';

    res.status(200).json({
      success: true,
      data: {
        marketId: id,
        winningTokenId,
        globalMu: state.mu,
        finalPrice,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
