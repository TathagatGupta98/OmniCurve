import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import dotenv from 'dotenv';
import healthRoutes from './routes/health';
import marketRoutes from './routes/marketRoutes';
import webhookRoutes from './webhooks/goldskyHandler';
import { errorHandler } from './middlewares/errorHandler';
import { initializeSocket } from './sockets/socketManager';
import { startGoldskyPolling } from './indexer/pollGoldsky';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middlewares
app.use(helmet());
app.use(cors());

// Capture raw body for signature verification
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', healthRoutes);
app.use('/api/markets', marketRoutes);
app.use('/api/webhooks', webhookRoutes);

// Global Error Handler
app.use(errorHandler);

const httpServer = createServer(app);
initializeSocket(httpServer);

// Start GraphQL Indexer Polling
startGoldskyPolling();

httpServer.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
