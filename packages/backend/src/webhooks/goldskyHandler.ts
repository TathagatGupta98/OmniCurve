import { Router, Request, Response, NextFunction } from 'express';
import { verifyGoldskySignature } from '../middlewares/goldskyAuth';
import * as indexerService from '../services/indexerService';

const router = Router();

const SUPPORTED_EVENT_TYPES = new Set([
  'LiquidityAdded',
  'StakePlaced',
  'MarketCreated',
  'MarketResolved',
]);

router.post('/goldsky', verifyGoldskySignature, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventType, data } = req.body;

    if (!eventType || !data) {
      return res.status(400).json({ success: false, error: 'Request body must include "eventType" and "data"' });
    }

    switch (eventType) {
      case 'LiquidityAdded':
        await indexerService.handleLiquidityAdded(data);
        break;

      case 'StakePlaced':
        await indexerService.handleStakePlaced(data);
        break;

      case 'MarketCreated':
        await indexerService.handleMarketCreated(data);
        break;

      case 'MarketResolved':
        await indexerService.handleMarketResolved(data);
        break;

      default:
        // Unknown event types are acknowledged (200) but not processed.
        // Returning 400 would cause Goldsky to retry indefinitely.
        console.log(`[Goldsky] Ignoring unknown event type: ${eventType}`);
        return res.status(200).json({ success: true, message: `Event type "${eventType}" ignored` });
    }

    res.status(200).json({ success: true, message: `${eventType} processed successfully` });
  } catch (error) {
    next(error);
  }
});

export default router;
