import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import DistributionGraph from './DistributionGraph';
import StakerPanel from './StakerPanel';
import LPPanel from './LPPanel';

// For local testing
const API_URL = 'http://localhost:3001';

const MarketDetailsPage = () => {
  const marketId = '0x1234567890abcdef'; // Hardcoded mock marketId for testing UI
  const [marketData, setMarketData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'STAKER' | 'LP'>('STAKER');
  const [targetX, setTargetX] = useState<number | undefined>(undefined);

  useEffect(() => {
    // 1. Fetch initial state
    const fetchMarket = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/markets/${marketId}`);
        if (res.data.success) {
          setMarketData(res.data.data);
        }
      } catch (err) {
        console.error('Error fetching market', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMarket();

    // 2. Setup WebSockets
    const socket = io(API_URL);
    socket.emit('joinMarket', marketId);

    socket.on('marketStateUpdated', (newData) => {
      console.log('Real-time update received:', newData);
      setMarketData((prev: any) => ({ ...prev, ...newData }));
    });

    return () => {
      socket.disconnect();
    };
  }, [marketId]);

  if (loading) return <div className="p-8 text-center text-zinc-400">Loading Market Data...</div>;
  if (!marketData) return <div className="p-8 text-center text-red-400">Market not found. Run DB Seed script.</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-extrabold !text-white !mb-2 !mt-0">{marketData.title}</h1>
          <p className="text-lg text-zinc-400">{marketData.category} Market</p>
        </div>
        <div className="flex gap-4 bg-zinc-900 p-4 rounded-lg border border-zinc-800">
          <div>
            <div className="text-xs text-zinc-500 uppercase">Current Mu</div>
            <div className="text-xl font-mono text-indigo-400">{marketData.currentMu}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500 uppercase">Current Sigma</div>
            <div className="text-xl font-mono text-emerald-400">{marketData.currentSigma}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500 uppercase">Total Liquidity</div>
            <div className="text-xl font-mono">${marketData.totalLiquidity.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Dynamic Graph */}
      <DistributionGraph 
        mu={marketData.currentMu} 
        sigma={marketData.currentSigma} 
        targetX={targetX} 
      />

      {/* Tabs */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="flex border-b border-zinc-800">
          <button 
            className={`flex-1 py-4 font-semibold text-sm tracking-wider transition-colors ${activeTab === 'STAKER' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
            onClick={() => setActiveTab('STAKER')}
          >
            TRADER / STAKER
          </button>
          <button 
            className={`flex-1 py-4 font-semibold text-sm tracking-wider transition-colors ${activeTab === 'LP' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
            onClick={() => setActiveTab('LP')}
          >
            LIQUIDITY PROVIDER (PRO)
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'STAKER' && (
            <StakerPanel marketId={marketId} onXChange={(val) => setTargetX(val)} />
          )}
          {activeTab === 'LP' && (
            <LPPanel marketId={marketId} currentMu={marketData.currentMu} currentSigma={marketData.currentSigma} />
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketDetailsPage;
