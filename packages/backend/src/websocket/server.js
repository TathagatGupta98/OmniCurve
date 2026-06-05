require('dotenv').config({ path: require('path').resolve(__dirname, '../../../../.env') });
const WebSocket = require('ws');
const { createPublicClient, http, parseAbiItem } = require('viem');
const { arbitrumSepolia } = require('viem/chains');
const { formatCurveData } = require('../server/utils');

const WS_PORT = process.env.WS_PORT || 3002;
const RPC_URL = process.env.RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc';
const DISTRIBUTION_AMM_ADDRESS = process.env.DISTRIBUTION_AMM_ADDRESS;

if (!DISTRIBUTION_AMM_ADDRESS) {
  console.error('Missing DISTRIBUTION_AMM_ADDRESS in environment variables.');
  process.exit(1);
}

const wss = new WebSocket.Server({ port: WS_PORT });
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('✅ New WebSocket client connected');
  clients.add(ws);

  ws.on('close', () => {
    console.log('❌ WebSocket client disconnected');
    clients.delete(ws);
  });
});

console.log(`📡 WebSocket server is running on port ${WS_PORT}`);

const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(RPC_URL),
});

const CurveUpdatedEvent = parseAbiItem('event CurveUpdated(uint256 indexed new_mu, uint256 indexed new_sigma)');

publicClient.watchEvent({
  address: DISTRIBUTION_AMM_ADDRESS,
  event: CurveUpdatedEvent,
  onLogs: logs => {
    logs.forEach(log => {
      const { new_mu, new_sigma } = log.args;
      const formattedData = formatCurveData(new_mu, new_sigma);

      const payload = JSON.stringify({
        type: 'CurveUpdated',
        data: formattedData
      });

      console.log('🔄 Broadcasting CurveUpdated to clients:', formattedData);

      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
    });
  }
});
