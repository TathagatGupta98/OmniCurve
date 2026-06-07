import { GraphQLClient, gql } from 'graphql-request';
import * as indexerService from '../services/indexerService';

const GOLDSKY_GRAPHQL_ENDPOINT = process.env.GOLDSKY_GRAPHQL_ENDPOINT;
const MARKET_ID = '0x1234567890abcdef'; // The mock market ID for UI test

const GET_LATEST_EVENTS = gql`
  query GetLatestEvents($timestamp: BigInt!) {
    curveUpdateds(first: 5, orderBy: timestamp_, orderDirection: asc, where: { timestamp__gt: $timestamp }) {
      new_mu
      new_sigma
      timestamp_
      transactionHash_
    }
    tradeExecuteds(first: 5, orderBy: timestamp_, orderDirection: asc, where: { timestamp__gt: $timestamp }) {
      user
      target_price
      is_yes
      timestamp_
      transactionHash_
    }
  }
`;

let lastProcessedTimestamp = Math.floor(Date.now() / 1000).toString();

export const startGoldskyPolling = () => {
  if (!GOLDSKY_GRAPHQL_ENDPOINT) {
    console.warn('GOLDSKY_GRAPHQL_ENDPOINT not set. Polling disabled.');
    return;
  }

  const client = new GraphQLClient(GOLDSKY_GRAPHQL_ENDPOINT);

  console.log('📡 Starting Goldsky GraphQL Polling Service...');

  setInterval(async () => {
    try {
      const data: any = await client.request(GET_LATEST_EVENTS, { timestamp: lastProcessedTimestamp });

      // Process CurveUpdates (Liquidity or Market State changes)
      for (const curve of data.curveUpdateds || []) {
        console.log('🔄 New Curve Update detected on-chain!', curve);
        await indexerService.handleLiquidityAdded({
          marketId: MARKET_ID,
          userAddress: '0x0', // Fallback
          newMu: Number(curve.new_mu) / 1e15,
          newSigma: Number(curve.new_sigma) / 1e15,
          addedLiquidity: 1000 // Dummy value if subgraph lacks it
        });
        lastProcessedTimestamp = curve.timestamp_;
      }

      // Process Trades
      for (const trade of data.tradeExecuteds || []) {
        console.log('🔄 New Trade detected on-chain!', trade);
        await indexerService.handleStakePlaced({
          positionId: trade.transactionHash_,
          marketId: MARKET_ID,
          userAddress: trade.user,
          targetValueX: Number(trade.target_price) / 1e15,
          isYes: trade.is_yes,
          tokensMinted: 100, // Dummy
          stakeAmount: 100 // Dummy
        });
        lastProcessedTimestamp = trade.timestamp_;
      }

    } catch (error) {
      console.error('Error polling Goldsky GraphQL:', error);
    }
  }, 3000); // Poll every 3 seconds
};
