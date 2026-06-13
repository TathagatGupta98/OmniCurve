import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export const verifyGoldskySignature = (req: Request, res: Response, next: NextFunction) => {
  const secret = process.env.GOLDSKY_WEBHOOK_SECRET;
  
  if (!secret) {
    console.warn('GOLDSKY_WEBHOOK_SECRET is not set. Skipping signature verification.');
    return next();
  }

  const signature = req.headers['goldsky-webhook-signature'] as string;
  if (!signature) {
    return res.status(401).json({ success: false, error: 'Missing webhook signature' });
  }

  // Use rawBody if captured, otherwise fallback to JSON stringify
  const payload = (req as any).rawBody ? (req as any).rawBody.toString() : JSON.stringify(req.body);
  const computedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  if (signature !== computedSignature) {
    return res.status(403).json({ success: false, error: 'Invalid signature' });
  }

  next();
};
