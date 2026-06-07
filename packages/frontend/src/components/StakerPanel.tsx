import React, { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { BINARY_ROUTER_ABI, CONTRACTS } from '../config/abis';
import axios from 'axios';

const API_URL = 'http://localhost:3001';

interface StakerPanelProps {
  marketId: string;
  onXChange: (x: number | undefined) => void;
}

const StakerPanel: React.FC<StakerPanelProps> = ({ marketId, onXChange }) => {
  const [xVal, setXVal] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [direction, setDirection] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [expectedPrices, setExpectedPrices] = useState<{ pYes: number; pNo: number } | null>(null);

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Fetch optimistic prices when X changes (debounced)
  useEffect(() => {
    const fetchPrices = async () => {
      if (!xVal || isNaN(Number(xVal))) {
        setExpectedPrices(null);
        onXChange(undefined);
        return;
      }
      try {
        onXChange(Number(xVal));
        const res = await axios.get(`${API_URL}/api/markets/${marketId}?x=${xVal}`);
        if (res.data.success && res.data.data.expectedPrices) {
          setExpectedPrices(res.data.data.expectedPrices);
        }
      } catch (e) {
        console.error('Failed to fetch expected prices', e);
      }
    };
    const timeoutId = setTimeout(fetchPrices, 300);
    return () => clearTimeout(timeoutId);
  }, [xVal, marketId, onXChange]);

  const handleStake = async () => {
    if (!xVal || !amount) return;
    
    // Note: In reality, we should check/approve USDC first.
    // For this MVP UI test, we execute the Router trade.
    writeContract({
      address: CONTRACTS.BINARY_ROUTER,
      abi: BINARY_ROUTER_ABI,
      functionName: direction === 'ABOVE' ? 'buyYes' : 'buyNo',
      args: [BigInt(Math.floor(Number(xVal))), parseUnits(amount, 6)], // Assuming USDC uses 6 decimals and X is scaled locally
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm text-zinc-400 uppercase">Target Strike Price (X)</label>
          <input 
            type="number" 
            placeholder="e.g. 3500" 
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
            value={xVal}
            onChange={(e) => setXVal(e.target.value)}
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm text-zinc-400 uppercase">Direction</label>
          <div className="flex gap-2">
            <button 
              className={`flex-1 p-3 rounded-lg border font-semibold transition-all ${direction === 'ABOVE' ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)]' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}
              onClick={() => setDirection('ABOVE')}
            >
              YES (ABOVE X)
            </button>
            <button 
              className={`flex-1 p-3 rounded-lg border font-semibold transition-all ${direction === 'BELOW' ? 'bg-rose-600 border-rose-500 text-white shadow-[0_0_15px_rgba(225,29,72,0.3)]' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}
              onClick={() => setDirection('BELOW')}
            >
              NO (BELOW X)
            </button>
          </div>
        </div>
      </div>

      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 flex justify-between items-center">
        <div>
          <div className="text-sm text-zinc-500 uppercase">Expected Token Price</div>
          <div className="text-2xl font-mono text-white">
            {expectedPrices ? (
               direction === 'ABOVE' ? `$${expectedPrices.pYes.toFixed(4)}` : `$${expectedPrices.pNo.toFixed(4)}`
            ) : '--'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-zinc-500 uppercase">Opposite Side</div>
          <div className="text-lg font-mono text-zinc-400">
            {expectedPrices ? (
               direction === 'ABOVE' ? `$${expectedPrices.pNo.toFixed(4)}` : `$${expectedPrices.pYes.toFixed(4)}`
            ) : '--'}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-zinc-400 uppercase">Investment Amount (USDC)</label>
        <input 
          type="number" 
          placeholder="0.00" 
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <button 
        className="w-full py-4 rounded-lg font-bold text-lg text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleStake}
        disabled={isPending || isConfirming || !xVal || !amount}
      >
        {isPending ? 'Confirm in Wallet...' : isConfirming ? 'Transaction Pending...' : 'Execute Trade'}
      </button>

      {isSuccess && (
        <div className="p-3 bg-emerald-900/30 border border-emerald-800 text-emerald-400 rounded-lg text-center text-sm">
          Transaction Confirmed! Goldsky webhook is processing your trade...
        </div>
      )}
    </div>
  );
};

export default StakerPanel;
