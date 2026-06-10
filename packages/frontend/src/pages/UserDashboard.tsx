import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { usePortfolio } from '@/hooks/usePortfolio'
import { useTheme } from '@/hooks/useTheme'
import { Badge } from '@/components/ui/Badge'

const DARK = {
  walletCard:      'bg-[#111111] border-[rgba(255,255,255,0.08)]',
  walletLabel:     'text-[rgba(242,242,242,0.35)]',
  walletAddress:   'text-[#F2F2F2]',
  walletValue:     'text-[#C41230]',
  sectionHeading:  'text-[#F2F2F2]',
  skeleton:        'bg-[#111111]',
  emptyBorder:     'border-[rgba(255,255,255,0.08)]',
  emptyText:       'text-[rgba(242,242,242,0.35)]',
  emptyLink:       'text-[#C41230]',
  tableBorder:     'border-[rgba(255,255,255,0.08)]',
  tableHead:       'border-[rgba(255,255,255,0.08)] bg-[#0F0F0F]',
  tableHeadTxt:    'text-[rgba(242,242,242,0.35)]',
  tableRow:        'border-[rgba(255,255,255,0.05)] hover:bg-[#141414]',
  cellLink:        'text-[#F2F2F2] hover:text-[#C41230]',
  cellMuted:       'text-[rgba(242,242,242,0.6)]',
  cellData:        'text-[#C41230]',
} as const

const LIGHT = {
  walletCard:      'bg-[rgba(17,17,17,0.03)] border-[rgba(0,0,0,0.09)]',
  walletLabel:     'text-[rgba(17,17,17,0.38)]',
  walletAddress:   'text-[#111111]',
  walletValue:     'text-[#C41230]',
  sectionHeading:  'text-[#111111]',
  skeleton:        'bg-[rgba(17,17,17,0.04)]',
  emptyBorder:     'border-[rgba(0,0,0,0.2)]',
  emptyText:       'text-[rgba(17,17,17,0.38)]',
  emptyLink:       'text-[#C41230]',
  tableBorder:     'border-[rgba(0,0,0,0.2)]',
  tableHead:       'border-[rgba(0,0,0,0.2)] bg-[rgba(17,17,17,0.03)]',
  tableHeadTxt:    'text-[rgba(17,17,17,0.38)]',
  tableRow:        'border-[rgba(0,0,0,0.12)] hover:bg-[rgba(17,17,17,0.02)]',
  cellLink:        'text-[#111111] hover:text-[#C41230]',
  cellMuted:       'text-[rgba(17,17,17,0.6)]',
  cellData:        'text-[#C41230]',
} as const

export default function UserDashboard() {
  const { address } = useAccount()
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const T = isDark ? DARK : LIGHT
  const { data: portfolio, isLoading } = usePortfolio(address)

  useEffect(() => {
    if (!address) navigate('/')
  }, [address, navigate])

  if (!address) return null

  const positions = portfolio?.positions ?? []
  const lpPositions = portfolio?.lpPositions ?? []
  const totalValue = portfolio?.totalValue ?? 0

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#0A0A0A]' : 'bg-[#F3EFE8]'}`}>
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      {/* Wallet card */}
      <div className={`flex items-center justify-between p-6 border rounded transition-colors duration-300 ${T.walletCard}`}>
        <div>
          <p className={`text-xs font-display tracking-widest uppercase mb-1 transition-colors duration-300 ${T.walletLabel}`}>
            Wallet
          </p>
          <p className={`font-mono text-sm transition-colors duration-300 ${T.walletAddress}`}>{address}</p>
        </div>
        <div className="text-right">
          <p className={`text-xs font-display tracking-widest uppercase mb-1 transition-colors duration-300 ${T.walletLabel}`}>
            Portfolio Value
          </p>
          <p className={`font-mono text-2xl transition-colors duration-300 ${T.walletValue}`}>
            ${totalValue.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Positions table */}
      <section>
        <h2 className={`font-display font-700 text-lg mb-4 transition-colors duration-300 ${T.sectionHeading}`}>Open Positions</h2>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={`h-14 rounded animate-pulse transition-colors duration-300 ${T.skeleton}`} />
            ))}
          </div>
        ) : positions.length === 0 ? (
          <div className={`text-center py-12 border rounded transition-colors duration-300 ${T.emptyBorder}`}>
            <p className={`font-mono text-sm transition-colors duration-300 ${T.emptyText}`}>No open positions</p>
            <Link
              to="/markets"
              className={`inline-block mt-3 text-xs font-mono hover:underline transition-colors duration-200 ${T.emptyLink}`}
            >
              Explore Markets →
            </Link>
          </div>
        ) : (
          <div className={`border rounded overflow-hidden transition-colors duration-300 ${T.tableBorder}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b transition-colors duration-300 ${T.tableHead}`}>
                  {['Market', 'Direction', 'Strike', 'Tokens', 'Value', 'Status'].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-left text-[10px] font-display tracking-widest uppercase transition-colors duration-300 ${T.tableHeadTxt}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => (
                  <tr
                    key={pos.positionId}
                    className={`border-b transition-colors duration-200 ${T.tableRow}`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/markets/${pos.marketId}`}
                        className={`font-display text-xs line-clamp-1 transition-colors duration-200 ${T.cellLink}`}
                      >
                        {pos.market?.title ?? `#${pos.marketId}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={pos.direction === 'ABOVE' ? 'yes' : 'no'}>
                        {pos.direction === 'ABOVE' ? 'YES' : 'NO'}
                      </Badge>
                    </td>
                    <td className={`px-4 py-3 font-mono text-xs transition-colors duration-300 ${T.cellMuted}`}>
                      {pos.targetValueX.toLocaleString()}
                    </td>
                    <td className={`px-4 py-3 font-mono text-xs transition-colors duration-300 ${T.cellMuted}`}>
                      {pos.tokensMinted.toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 font-mono text-xs transition-colors duration-300 ${T.cellData}`}>
                      ${(pos.stakeAmount / 1e6).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {pos.market?.isResolved ? (
                        <Badge variant="resolved">Resolved</Badge>
                      ) : (
                        <Badge variant="live">Active</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* LP Positions table */}
      <section>
        <h2 className={`font-display font-700 text-lg mb-4 transition-colors duration-300 ${T.sectionHeading}`}>Liquidity Positions</h2>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className={`h-14 rounded animate-pulse transition-colors duration-300 ${T.skeleton}`} />
            ))}
          </div>
        ) : lpPositions.length === 0 ? (
          <div className={`text-center py-12 border rounded transition-colors duration-300 ${T.emptyBorder}`}>
            <p className={`font-mono text-sm transition-colors duration-300 ${T.emptyText}`}>No liquidity positions</p>
          </div>
        ) : (
          <div className={`border rounded overflow-hidden transition-colors duration-300 ${T.tableBorder}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b transition-colors duration-300 ${T.tableHead}`}>
                  {['Market', 'LP Balance', 'Pending Fees', 'Status'].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-left text-[10px] font-display tracking-widest uppercase transition-colors duration-300 ${T.tableHeadTxt}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lpPositions.map((lp) => (
                  <tr
                    key={lp.marketId}
                    className={`border-b transition-colors duration-200 ${T.tableRow}`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/markets/${lp.marketId}`}
                        className={`font-display text-xs line-clamp-1 transition-colors duration-200 ${T.cellLink}`}
                      >
                        {lp.marketTitle ?? `#${lp.marketId}`}
                      </Link>
                    </td>
                    <td className={`px-4 py-3 font-mono text-xs transition-colors duration-300 ${T.cellMuted}`}>
                      {lp.lpBalance.toFixed(4)}
                    </td>
                    <td className={`px-4 py-3 font-mono text-xs transition-colors duration-300 ${T.cellData}`}>
                      ${lp.pendingRewards.toFixed(4)}
                    </td>
                    <td className="px-4 py-3">
                      {lp.market?.isResolved ? (
                        <Badge variant="resolved">Resolved</Badge>
                      ) : (
                        <Badge variant="live">Active</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
    </div>
  )
}
