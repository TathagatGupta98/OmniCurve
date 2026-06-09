import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /api/docs
 *
 * Returns an OpenAPI-style JSON schema describing all available endpoints
 * for frontend developers.
 */
router.get('/', (req: Request, res: Response) => {
  const docs = {
    openapi: '3.0.0',
    info: {
      title: 'OmniCurve Backend API',
      version: '1.0.0',
      description: 'REST API for the OmniCurve prediction market protocol.',
    },
    basePath: '/api',
    endpoints: [
      {
        path: '/api/health',
        method: 'GET',
        description: 'Health check',
        response: { status: 'OK', timestamp: 'ISO 8601 string' },
      },
      {
        path: '/api/markets',
        method: 'GET',
        description: 'List all markets with optional filtering',
        queryParams: {
          category: { type: 'string', required: false, description: 'Filter by market category' },
          active: { type: 'boolean', required: false, description: 'Filter by active status (has liquidity)' },
        },
        response: { success: true, data: ['Market[]'] },
      },
      {
        path: '/api/markets/:marketId',
        method: 'GET',
        description: 'Get detailed market info including positions',
        params: { marketId: { type: 'string', required: true } },
        queryParams: {
          x: { type: 'number', required: false, description: 'Target strike price for price calculation' },
        },
        response: { success: true, data: { '...market': 'Market', expectedPrices: '{ pYes, pNo } | null' } },
      },
      {
        path: '/api/markets/:id/price',
        method: 'GET',
        description: 'Price preview for the staker UI — returns expected prices and fee breakdown',
        params: { id: { type: 'string', required: true, description: 'Market ID' } },
        queryParams: {
          x: { type: 'number', required: true, description: 'Target price strike value' },
          direction: { type: 'string', enum: ['yes', 'no'], required: true, description: 'Trade direction' },
          stakeAmount: { type: 'number', required: false, description: 'Stake amount for fee calculation (WAD float)' },
        },
        response: {
          success: true,
          data: {
            pYes: 'number (0-1)',
            pNo: 'number (0-1)',
            grossCostWad: 'number',
            feeCostWad: 'number',
            netStake: 'number',
            tokensMinted: 'number',
          },
        },
      },
      {
        path: '/api/users/:address/portfolio',
        method: 'GET',
        description: 'Get all positions for a wallet address with current value estimates',
        params: { address: { type: 'string', required: true, description: 'Ethereum wallet address (0x...)' } },
        response: {
          success: true,
          data: {
            address: 'string',
            positionCount: 'number',
            positions: [{
              positionId: 'string',
              marketId: 'string',
              direction: 'ABOVE | BELOW',
              tokensMinted: 'number',
              stakeAmount: 'number',
              currentValue: 'number',
              status: 'active | won | lost',
            }],
          },
        },
      },
      {
        path: '/api/markets/:id/lp-stats',
        method: 'GET',
        description: 'LP statistics — on-chain LP token balance, accumulated fees, and pending rewards',
        params: { id: { type: 'string', required: true, description: 'Market ID' } },
        queryParams: {
          address: { type: 'string', required: true, description: 'LP wallet address (0x...)' },
        },
        response: {
          success: true,
          data: {
            marketId: 'string',
            lpTokenBalance: 'number (WAD float)',
            accFeePerShare: 'number (WAD float)',
            rewardDebt: 'number (WAD float)',
            pendingRewards: 'number (WAD float)',
          },
        },
      },
      {
        path: '/api/markets/:id/settle',
        method: 'POST',
        description: 'Owner-only settlement preview — determines winning token based on final price vs mu. Does NOT send a chain transaction.',
        params: { id: { type: 'string', required: true, description: 'Market ID' } },
        headers: {
          'x-owner-address': { type: 'string', required: true, description: 'Contract owner address for authorization' },
        },
        body: {
          finalPrice: { type: 'number', required: true, description: 'The final outcome price' },
        },
        response: {
          success: true,
          data: {
            marketId: 'string',
            winningTokenId: 'string (0 = NO, 1 = YES)',
            globalMu: 'number',
            finalPrice: 'number',
          },
        },
      },
      {
        path: '/api/webhooks/goldsky',
        method: 'POST',
        description: 'Goldsky webhook receiver for indexing on-chain events',
        headers: {
          'x-goldsky-signature': { type: 'string', required: true },
        },
        body: {
          eventType: { type: 'string', enum: ['LiquidityAdded', 'StakePlaced'] },
          data: 'object (event-specific payload)',
        },
      },
    ],
    socketEvents: {
      client: {
        joinMarket: { payload: 'marketId: string', description: 'Subscribe to real-time updates for a market' },
        leaveMarket: { payload: 'marketId: string', description: 'Unsubscribe from market updates' },
      },
      server: {
        marketStateUpdated: {
          payload: '{ currentMu, currentSigma, totalLiquidity }',
          description: 'Emitted to market room when on-chain state changes',
        },
        marketResolved: {
          payload: '{ winningTokenId }',
          description: 'Emitted to market room when market is resolved',
        },
      },
    },
    rateLimit: {
      window: '1 minute',
      maxRequests: 100,
      scope: 'Per IP, all /api/* routes',
    },
  };

  res.status(200).json(docs);
});

export default router;
