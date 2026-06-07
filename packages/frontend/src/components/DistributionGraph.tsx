import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
// @ts-ignore
import { jStat } from 'jstat';

interface DistributionGraphProps {
  mu: number;
  sigma: number;
  targetX?: number; // Optional selected strike price to show a reference line
}

const DistributionGraph: React.FC<DistributionGraphProps> = ({ mu, sigma, targetX }) => {
  // Generate data points for the normal distribution curve
  const data = useMemo(() => {
    const points = [];
    // Plot from mu - 4*sigma to mu + 4*sigma
    const safeSigma = Math.max(sigma, 0.001); // avoid 0
    const min = mu - 4 * safeSigma;
    const max = mu + 4 * safeSigma;
    const step = (max - min) / 100; // 100 points for smooth curve

    for (let x = min; x <= max; x += step) {
      // PDF gives the height of the curve
      const y = jStat.normal.pdf(x, mu, safeSigma);
      points.push({
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(6)),
      });
    }
    return points;
  }, [mu, sigma]);

  return (
    <div className="w-full h-80 bg-zinc-900 rounded-xl p-4 border border-zinc-800 shadow-lg" style={{ minHeight: '320px' }}>
      <ResponsiveContainer width="100%" height="100%" minHeight={320}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorY" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis 
            dataKey="x" 
            stroke="#a1a1aa" 
            tick={{ fill: '#a1a1aa' }}
            domain={['dataMin', 'dataMax']}
            type="number"
            tickFormatter={(val) => val.toFixed(0)}
          />
          <YAxis 
            domain={['auto', 'auto']} 
            stroke="#a1a1aa"
            tick={{ fill: '#a1a1aa' }}
            tickFormatter={(val) => val.toFixed(4)}
            width={80}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f8fafc' }}
            itemStyle={{ color: '#818cf8' }}
            formatter={(value: any, _name: any, props: any) => [
              `Probability Density: ${value}`, 
              `Price: $${props.payload.x}`
            ]}
          />
          <Area 
            type="monotone" 
            dataKey="y" 
            stroke="#818cf8" 
            fillOpacity={1} 
            fill="url(#colorY)" 
          />
          {targetX !== undefined && !isNaN(targetX) && (
            <ReferenceLine 
              x={targetX} 
              stroke="#fbbf24" 
              strokeDasharray="3 3" 
              label={{ position: 'top', value: `X = ${targetX}`, fill: '#fbbf24' }} 
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DistributionGraph;
