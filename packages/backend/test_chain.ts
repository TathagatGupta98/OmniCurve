import { createPublicClient, http, formatUnits, getAddress } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
const AMM_ADDRESS = getAddress('0x362d19969BF76805b684d6f5FB0B9fE33e4e439D');
const USDC_ADDRESS = getAddress('0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d');
const AMM_ABI = [
  { inputs: [], name: 'globalMu', outputs: [{ type: 'int256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'globalSigma', outputs: [{ type: 'int256' }], stateMutability: 'view', type: 'function' }
] as const;
const ERC20_ABI = [
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }
] as const;
async function test() {
  const client = createPublicClient({ chain: arbitrumSepolia, transport: http() });
  const [mu, sigma, ammusdc] = await Promise.all([
    client.readContract({ address: AMM_ADDRESS, abi: AMM_ABI, functionName: 'globalMu' }),
    client.readContract({ address: AMM_ADDRESS, abi: AMM_ABI, functionName: 'globalSigma' }),
    client.readContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: [AMM_ADDRESS] })
  ]);
  console.log({ mu: Number(mu)/1e15, sigma: Number(sigma)/1e15, amm_usdc: formatUnits(ammusdc as bigint, 6) });
}
test().catch(console.error);
