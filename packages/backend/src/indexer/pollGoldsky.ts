import { createPublicClient, http, formatUnits, getAddress } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import prisma from '../models/db';
import { broadcastMarketUpdate } from '../sockets/socketManager';

const MARKET_ID = '0x1234567890abcdef'; // The mock market ID for UI test
const AMM_ADDRESS = getAddress('0x362d19969BF76805b684d6f5FB0B9fE33e4e439D');
const USDC_ADDRESS = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d' as const;

const AMM_ABI = [
  { inputs: [], name: 'globalMu', outputs: [{ type: 'int256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'globalSigma', outputs: [{ type: 'int256' }], stateMutability: 'view', type: 'function' }
] as const;

const ERC20_ABI = [
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }
] as const;

export const startGoldskyPolling = () => {
  console.log('📡 Starting Direct On-Chain Polling Service (Bypassing Goldsky)...');

  const client = createPublicClient({
    chain: arbitrumSepolia,
    transport: http()
  });

  let lastMu: number | null = null;
  let lastSigma: number | null = null;
  let lastLiquidity: number | null = null;

  setInterval(async () => {
    try {
      const [muData, sigmaData, usdcBalance] = await Promise.all([
        client.readContract({ address: AMM_ADDRESS, abi: AMM_ABI, functionName: 'globalMu' }),
        client.readContract({ address: AMM_ADDRESS, abi: AMM_ABI, functionName: 'globalSigma' }),
        client.readContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: [AMM_ADDRESS] })
      ]);

      const mu = Number(muData) / 1e15;
      const sigma = Number(sigmaData) / 1e15;
      const liquidity = Number(formatUnits(usdcBalance as bigint, 6)); // USDC has 6 decimals

      // Only update if something changed
      if (mu !== lastMu || sigma !== lastSigma || liquidity !== lastLiquidity) {
        console.log(`🔄 On-chain update detected! Mu: ${mu}, Sigma: ${sigma}, Liquidity: ${liquidity}`);
        
        await prisma.market.update({
          where: { marketId: MARKET_ID },
          data: {
            currentMu: mu,
            currentSigma: sigma,
            totalLiquidity: liquidity
          }
        });

        broadcastMarketUpdate(MARKET_ID, {
          currentMu: mu,
          currentSigma: sigma,
          totalLiquidity: liquidity
        });

        lastMu = mu;
        lastSigma = sigma;
        lastLiquidity = liquidity;
      }
    } catch (error) {
      console.error('Error polling on-chain data:', error);
    }
  }, 3000); // Poll every 3 seconds
};
