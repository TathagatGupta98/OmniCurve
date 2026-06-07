import { Router, Request, Response, NextFunction } from 'express';
import { verifyGoldskySignature } from '../middlewares/goldskyAuth';
import * as indexerService from '../services/indexerService';

const router = Router();

router.post('/goldsky', verifyGoldskySignature, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventType, data } = req.body;

    let updatedMarket = null;

    if (eventType === 'LiquidityAdded') {
      updatedMarket = await indexerService.handleLiquidityAdded(data);
    } else if (eventType === 'StakePlaced') {
      updatedMarket = await indexerService.handleStakePlaced(data);
    } else {
      return res.status(400).json({ success: false, error: 'Unknown or unsupported event type' });
    }

    res.status(200).json({ success: true, message: 'Webhook processed successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
