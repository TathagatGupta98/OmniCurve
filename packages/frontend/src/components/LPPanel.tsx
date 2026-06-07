import React, { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { DISTRIBUTION_AMM_ABI, CONTRACTS } from '../config/abis';

interface LPPanelProps {
  marketId: string;
  currentMu: number;
  currentSigma: number;
}

const LPPanel: React.FC<LPPanelProps> = ({ currentMu, currentSigma }) => {
  const [targetMu, setTargetMu] = useState<string>(currentMu.toString());
  const [targetSigma, setTargetSigma] = useState<string>(currentSigma.toString());
  const [amount, setAmount] = useState<string>('');

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleAddLiquidity = () => {
    if (!amount || !targetMu || !targetSigma) return;

    writeContract({
      address: CONTRACTS.DISTRIBUTION_AMM,
      abi: DISTRIBUTION_AMM_ABI,
      functionName: 'addLiquidity',
      args: [parseUnits(amount, 6), BigInt(Math.floor(Number(targetMu))), BigInt(Math.floor(Number(targetSigma)))],
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="p-4 bg-emerald-950/20 border border-emerald-900/50 rounded-lg mb-6">
        <p className="text-emerald-400/80 text-sm">
          As a Pro Liquidity Provider, your deposited capital shapes the market. Specify your belief of the true $\mu$ and $\sigma$. Your liquidity will gently pull the global distribution towards your target values.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm text-zinc-400 uppercase">Target Mu ($\mu$)</label>
          <input 
            type="number" 
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
            value={targetMu}
            onChange={(e) => setTargetMu(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-zinc-400 uppercase">Target Sigma ($\sigma$)</label>
          <input 
            type="number" 
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
            value={targetSigma}
            onChange={(e) => setTargetSigma(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-zinc-400 uppercase">Liquidity to Provide (USDC)</label>
        <input 
          type="number" 
          placeholder="0.00" 
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <button 
        className="w-full py-4 rounded-lg font-bold text-lg text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleAddLiquidity}
        disabled={isPending || isConfirming || !amount || !targetMu || !targetSigma}
      >
        {isPending ? 'Confirm in Wallet...' : isConfirming ? 'Transaction Pending...' : 'Provide Liquidity'}
      </button>

      {isSuccess && (
        <div className="p-3 bg-emerald-900/30 border border-emerald-800 text-emerald-400 rounded-lg text-center text-sm">
          Liquidity successfully added! Goldsky webhook is syncing...
        </div>
      )}
    </div>
  );
};

export default LPPanel;
