import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAccount, useWriteContract, usePublicClient } from 'wagmi'
import { useMarket } from '@/hooks/useMarket'
import { useMarketSocket } from '@/hooks/useMarketSocket'
import { usePortfolio } from '@/hooks/usePortfolio'
import { useEthPrice } from '@/hooks/useEthPrice'
import { useTheme } from '@/hooks/useTheme'
import { GaussianChart } from '@/components/market/GaussianChart'
import { StakerPanel } from '@/components/market/StakerPanel'
import { LPPanel } from '@/components/market/LPPanel'
import { Tabs } from '@/components/ui/Tabs'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { shortAddr, floatToWad } from '@/lib/math'
import { getGasFees, estimateGasLimit } from '@/lib/gas'
import { AMM_ABI, ROUTER_ABI } from '@/config/contracts'

const TRADE_TABS = [
  { label: 'Trade', value: 'trade' },
  { label: 'Provide Liquidity', value: 'lp' },
]

const DARK = {
  loadSkeleton:   'bg-[#1C1C1C]',
  errorText:      'text-[#FF4560]',
  heading:        'text-[#F2F2F2]',
  badgeNum:       'text-[rgba(242,242,242,0.50)]',
  statsStrip:     'border-[rgba(255,255,255,0.15)]',
  statLabel:      'text-[rgba(242,242,242,0.55)]',
  statMu:         'text-[#C41230]',
  statSigma:      'text-[#F2F2F2]',
  statLiq:        'text-[#F2F2F2]',
  chartCard:      'bg-[#1A1A1A] border-[rgba(255,255,255,0.18)]',
  yesResolved:    'bg-[rgba(34,211,163,0.12)] border-[rgba(34,211,163,0.35)]',
  yesResolvedTxt: 'text-[#22D3A3]',
  noResolved:     'bg-[rgba(255,69,96,0.12)] border-[rgba(255,69,96,0.35)]',
  noResolvedTxt:  'text-[#FF4560]',
  resolvedSub:    'text-[rgba(242,242,242,0.60)]',
  noPositions:    'text-[rgba(242,242,242,0.50)]',
  ownerBox:       'border-[rgba(196,18,48,0.40)] bg-[rgba(196,18,48,0.10)]',
  ownerLabel:     'text-[#C41230]',
  panelCard:      'bg-[#1A1A1A] border-[rgba(255,255,255,0.18)]',
  infoCard:       'border-[rgba(255,255,255,0.15)]',
  infoHeading:    'text-[rgba(242,242,242,0.55)]',
  infoLabel:      'text-[rgba(242,242,242,0.55)]',
  infoLink:       'text-[rgba(242,242,242,0.75)] hover:text-[#C41230]',
  liveIndicator:  'bg-[#22D3A3]',
  liveTxt:        'text-[#22D3A3]',
} as const

const LIGHT = {
  loadSkeleton:   'bg-[rgba(17,17,17,0.06)]',
  errorText:      'text-[#dc2626]',
  heading:        'text-[#111111]',
  badgeNum:       'text-[rgba(17,17,17,0.50)]',
  statsStrip:     'border-[rgba(0,0,0,0.18)]',
  statLabel:      'text-[rgba(17,17,17,0.55)]',
  statMu:         'text-[#C41230]',
  statSigma:      'text-[#111111]',
  statLiq:        'text-[#111111]',
  chartCard:      'bg-white border-[rgba(0,0,0,0.20)]',
  yesResolved:    'bg-[rgba(5,150,105,0.10)] border-[rgba(5,150,105,0.35)]',
  yesResolvedTxt: 'text-[#059669]',
  noResolved:     'bg-[rgba(220,38,38,0.10)] border-[rgba(220,38,38,0.35)]',
  noResolvedTxt:  'text-[#dc2626]',
  resolvedSub:    'text-[rgba(17,17,17,0.60)]',
  noPositions:    'text-[rgba(17,17,17,0.50)]',
  ownerBox:       'border-[rgba(196,18,48,0.35)] bg-[rgba(196,18,48,0.08)]',
  ownerLabel:     'text-[#C41230]',
  panelCard:      'bg-white border-[rgba(0,0,0,0.20)]',
  infoCard:       'border-[rgba(0,0,0,0.20)]',
  infoHeading:    'text-[rgba(17,17,17,0.55)]',
  infoLabel:      'text-[rgba(17,17,17,0.55)]',
  infoLink:       'text-[rgba(17,17,17,0.70)] hover:text-[#C41230]',
  liveIndicator:  'bg-[#059669]',
  liveTxt:        'text-[#059669]',
} as const

export default function MarketDetail() {
  const { marketId } = useParams<{ marketId: string }>()
  const { address } = useAccount()
  const { isDark } = useTheme()
  const T = isDark ? DARK : LIGHT

  const { data: market, isLoading, error } = useMarket(marketId)
  const { liveState, isResolved: socketResolved, winningTokenId } = useMarketSocket(marketId)
  const { data: portfolio } = usePortfolio(address)
  const { ethUsd } = useEthPrice()
  const [activeTab, setActiveTab] = useState('trade')
  const [strikeX, setStrikeX] = useState<number | undefined>()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`h-16 rounded animate-pulse transition-colors duration-300 ${T.loadSkeleton}`} />
        ))}
      </div>
    )
  }

  if (error || !market) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-20 text-center">
        <p className={`font-mono transition-colors duration-300 ${T.errorText}`}>Market not found</p>
      </div>
    )
  }

  const mu = liveState?.currentMu ?? market.currentMu
  const sigma = liveState?.currentSigma ?? market.currentSigma
  const liquidity = Math.max(0, liveState?.totalLiquidity ?? market.totalLiquidity)
  const resolved = socketResolved || market.isResolved
  const winId = winningTokenId ?? (market.winningTokenId ? String(market.winningTokenId) : null)
  const isOwner = !!address && !!market.ownerAddress &&
    address.toLowerCase() === market.ownerAddress.toLowerCase()

  const handleProposeResolution = async (winningId: number) => {
    const gasFees = await getGasFees(publicClient)
    const gas = address
      ? await estimateGasLimit(publicClient, {
          address: market.ammAddress as `0x${string}`,
          abi: AMM_ABI,
          functionName: 'proposeResolution',
          args: [BigInt(winningId)],
          account: address,
        })
      : undefined
    await writeContractAsync({
      address: market.ammAddress as `0x${string}`,
      abi: AMM_ABI,
      functionName: 'proposeResolution',
      args: [BigInt(winningId)],
      ...gasFees,
      ...(gas ? { gas } : {}),
    })
  }

  const handleExecuteResolution = async () => {
    const gasFees = await getGasFees(publicClient)
    const gas = address
      ? await estimateGasLimit(publicClient, {
          address: market.ammAddress as `0x${string}`,
          abi: AMM_ABI,
          functionName: 'executeResolution',
          args: [],
          account: address,
        })
      : undefined
    await writeContractAsync({
      address: market.ammAddress as `0x${string}`,
      abi: AMM_ABI,
      functionName: 'executeResolution',
      args: [],
      ...gasFees,
      ...(gas ? { gas } : {}),
    })
  }

  const handleClaimWinnings = async (targetX: number, isYes: boolean) => {
    const gasFees = await getGasFees(publicClient)
    const claimArgs = [floatToWad(targetX), isYes] as const
    const gas = address
      ? await estimateGasLimit(publicClient, {
          address: market.routerAddress as `0x${string}`,
          abi: ROUTER_ABI,
          functionName: 'claimWinnings',
          args: claimArgs,
          account: address,
        })
      : undefined
    await writeContractAsync({
      address: market.routerAddress as `0x${string}`,
      abi: ROUTER_ABI,
      functionName: 'claimWinnings',
      args: claimArgs,
      ...gasFees,
      ...(gas ? { gas } : {}),
    })
  }

  const claimablePositions = (portfolio?.positions ?? []).filter(
    (p) =>
      String(p.marketId) === String(market.marketId) &&
      ((winId === '1' && p.direction === 'ABOVE') ||
        (winId === '2' && p.direction === 'BELOW')),
  )

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            {resolved ? (
              <Badge variant="resolved">Resolved</Badge>
            ) : (
              <Badge variant="live">Live</Badge>
            )}
            <span className={`text-xs font-mono transition-colors duration-300 ${T.badgeNum}`}>
              #{market.marketId}
            </span>
            <span className={`text-xs font-mono uppercase transition-colors duration-300 ${T.badgeNum}`}>
              {market.category}
            </span>
          </div>
          <h1 className={`font-display font-700 text-2xl sm:text-3xl tracking-tight leading-tight transition-colors duration-300 ${T.heading}`}>
            {market.title}
          </h1>
        </div>
      </div>

      {/* Stats strip */}
      <div className={`flex flex-wrap gap-6 py-3 border-y transition-colors duration-300 ${T.statsStrip}`}>
        <div>
          <p className={`text-[10px] font-display tracking-widest uppercase transition-colors duration-300 ${T.statLabel}`}>μ</p>
          <p className={`font-mono text-lg transition-colors duration-300 ${T.statMu}`}>{mu.toLocaleString()}</p>
        </div>
        <div>
          <p className={`text-[10px] font-display tracking-widest uppercase transition-colors duration-300 ${T.statLabel}`}>σ</p>
          <p className={`font-mono text-lg transition-colors duration-300 ${T.statSigma}`}>{sigma.toLocaleString()}</p>
        </div>
        <div>
          <p className={`text-[10px] font-display tracking-widest uppercase transition-colors duration-300 ${T.statLabel}`}>Liquidity</p>
          <p className={`font-mono text-lg transition-colors duration-300 ${T.statLiq}`}>
            ${liquidity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        {liveState && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse transition-colors duration-300 ${T.liveIndicator}`} />
            <span className={`text-xs font-mono transition-colors duration-300 ${T.liveTxt}`}>Live</span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className={`border rounded p-4 transition-colors duration-300 ${T.chartCard}`}>
        <GaussianChart
          mu={mu}
          sigma={sigma}
          strikeX={strikeX}
          liquidity={liquidity}
          height={300}
          {...(String(market.marketId) === '0'
            ? { spotX: ethUsd, spotLabel: `ETH $${ethUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` }
            : {})}
        />
      </div>

      {/* Resolution banner */}
      {resolved && winId && (
        <div className={`rounded border p-4 flex items-center justify-between flex-wrap gap-3 transition-colors duration-300 ${
          winId === '1' ? T.yesResolved : T.noResolved
        }`}>
          <div>
            <p className={`font-display font-600 text-sm transition-colors duration-300 ${
              winId === '1' ? T.yesResolvedTxt : T.noResolvedTxt
            }`}>
              Market Resolved — {winId === '1' ? 'YES' : 'NO'} Won
            </p>
            <p className={`text-xs font-mono mt-0.5 transition-colors duration-300 ${T.resolvedSub}`}>
              Winning token holders can claim USDC
            </p>
          </div>
          {address && (
            claimablePositions.length > 0 ? (
              <div className="flex flex-col gap-2 items-end">
                {claimablePositions.map((p) => (
                  <Button
                    key={p.positionId}
                    variant={winId === '1' ? 'ghost' : 'danger'}
                    size="sm"
                    className={winId === '1'
                      ? (isDark ? 'border-[#22D3A3] text-[#22D3A3]' : 'border-[#059669] text-[#059669]')
                      : ''}
                    onClick={() => handleClaimWinnings(p.targetValueX, p.direction === 'ABOVE')}
                  >
                    Claim @ {p.targetValueX.toLocaleString()} ({p.tokensMinted.toFixed(2)} tokens)
                  </Button>
                ))}
              </div>
            ) : (
              <p className={`text-xs font-mono transition-colors duration-300 ${T.noPositions}`}>
                No winning positions to claim
              </p>
            )
          )}
        </div>
      )}

      {/* Owner controls */}
      {isOwner && !resolved && (
        <div className={`border rounded p-4 transition-colors duration-300 ${T.ownerBox}`}>
          <p className={`text-xs font-display tracking-widest uppercase mb-3 transition-colors duration-300 ${T.ownerLabel}`}>
            Owner Controls
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => handleProposeResolution(1)}>
              Propose YES Win
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleProposeResolution(2)}>
              Propose NO Win
            </Button>
            <Button variant="muted" size="sm" onClick={handleExecuteResolution}>
              Execute Resolution
            </Button>
          </div>
        </div>
      )}

      {/* Trade / LP panels */}
      {!resolved && (
        <div className={`border rounded overflow-hidden transition-colors duration-300 ${T.panelCard}`}>
          <Tabs tabs={TRADE_TABS} active={activeTab} onChange={setActiveTab} />
          {activeTab === 'trade' ? (
            <StakerPanel market={{ ...market, currentMu: mu, currentSigma: sigma }} onStrikeChange={setStrikeX} />
          ) : (
            <LPPanel market={{ ...market, currentMu: mu, currentSigma: sigma, totalLiquidity: liquidity }} />
          )}
        </div>
      )}

      {/* Contract info */}
      <div className={`border rounded p-5 space-y-3 transition-colors duration-300 ${T.infoCard}`}>
        <h3 className={`font-display font-600 text-xs tracking-widest uppercase transition-colors duration-300 ${T.infoHeading}`}>
          Contract Addresses
        </h3>
        {[
          { label: 'AMM', addr: market.ammAddress },
          { label: 'Router', addr: market.routerAddress },
          { label: 'LP Token', addr: market.lpTokenAddress },
        ].map(({ label, addr }) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <span className={`text-xs font-display uppercase tracking-wider transition-colors duration-300 ${T.infoLabel}`}>{label}</span>
            <a
              href={`https://sepolia.arbiscan.io/address/${addr}`}
              target="_blank"
              rel="noreferrer"
              className={`font-mono text-xs transition-colors duration-200 ${T.infoLink}`}
            >
              {shortAddr(addr)} ↗
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
