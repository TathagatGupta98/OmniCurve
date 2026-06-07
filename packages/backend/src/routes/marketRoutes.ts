import { Router } from 'express';
import * as marketController from '../controllers/marketController';

const router = Router();

router.get('/', marketController.getMarkets);
router.get('/:marketId', marketController.getMarketDetails);

export default router;
