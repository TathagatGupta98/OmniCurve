import { useState } from 'react'
import { GaussianChart } from '@/components/market/GaussianChart'
import { Slider } from '@/components/ui/Slider'
import { useTheme } from '@/hooks/useTheme'
import { pYes, pNo } from '@/lib/math'

const SECTIONS = [
  { id: 'problem', label: 'The Problem' },
  { id: 'solution', label: 'The Solution' },
  { id: 'pricing', label: 'How Pricing Works' },
  { id: 'traders', label: 'For Traders' },
  { id: 'lps', label: 'For LPs' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'risks', label: 'Known Risks' },
]

const DARK = {
  sidebarLabel:   'text-[rgba(242,242,242,0.3)]',
  sidebarLink:    'text-[rgba(242,242,242,0.45)] hover:text-[#F2F2F2] hover:bg-[rgba(255,255,255,0.03)]',
  docTitle:       'text-[#F2F2F2]',
  docSubtitle:    'text-[rgba(242,242,242,0.5)]',
  sectionTitle:   'text-[#F2F2F2] border-[rgba(255,255,255,0.06)]',
  bodyText:       'text-[rgba(242,242,242,0.7)]',
  strong:         'text-[#F2F2F2]',
  yesText:        'text-[#22D3A3]',
  noText:         'text-[#FF4560]',
  codeBlock:      'bg-[rgba(196,18,48,0.05)] border-[rgba(196,18,48,0.15)]',
  codeYes:        'text-[#22D3A3]',
  codeNo:         'text-[#FF4560]',
  miniChart:      'bg-[#111111] border-[rgba(255,255,255,0.08)]',
  pYesBg:         'bg-[rgba(34,211,163,0.06)] border-[rgba(34,211,163,0.15)]',
  pYesLabel:      'text-[rgba(34,211,163,0.6)]',
  pYesVal:        'text-[#22D3A3]',
  pNoBg:          'bg-[rgba(255,69,96,0.06)] border-[rgba(255,69,96,0.15)]',
  pNoLabel:       'text-[rgba(255,69,96,0.6)]',
  pNoVal:         'text-[#FF4560]',
  pFormula:       'text-[rgba(242,242,242,0.35)]',
  codeBox:        'bg-[#111111] border-[rgba(255,255,255,0.07)] text-[rgba(242,242,242,0.6)]',
  code:           'text-[#C41230] font-mono text-sm',
  riskCard:       'bg-[#111111] border-[rgba(255,255,255,0.08)]',
  riskTitle:      'text-[#F2F2F2]',
  riskDesc:       'text-[rgba(242,242,242,0.55)]',
} as const

const LIGHT = {
  sidebarLabel:   'text-[rgba(17,17,17,0.32)]',
  sidebarLink:    'text-[rgba(17,17,17,0.5)] hover:text-[#111111] hover:bg-[rgba(17,17,17,0.04)]',
  docTitle:       'text-[#111111]',
  docSubtitle:    'text-[rgba(17,17,17,0.5)]',
  sectionTitle:   'text-[#111111] border-[rgba(0,0,0,0.2)]',
  bodyText:       'text-[rgba(17,17,17,0.65)]',
  strong:         'text-[#111111]',
  yesText:        'text-[#059669]',
  noText:         'text-[#dc2626]',
  codeBlock:      'bg-[rgba(196,18,48,0.05)] border-[rgba(196,18,48,0.18)]',
  codeYes:        'text-[#059669]',
  codeNo:         'text-[#dc2626]',
  miniChart:      'bg-[rgba(17,17,17,0.03)] border-[rgba(0,0,0,0.2)]',
  pYesBg:         'bg-[rgba(5,150,105,0.06)] border-[rgba(5,150,105,0.2)]',
  pYesLabel:      'text-[rgba(5,150,105,0.7)]',
  pYesVal:        'text-[#059669]',
  pNoBg:          'bg-[rgba(220,38,38,0.06)] border-[rgba(220,38,38,0.2)]',
  pNoLabel:       'text-[rgba(220,38,38,0.7)]',
  pNoVal:         'text-[#dc2626]',
  pFormula:       'text-[rgba(17,17,17,0.35)]',
  codeBox:        'bg-[rgba(17,17,17,0.03)] border-[rgba(0,0,0,0.2)] text-[rgba(17,17,17,0.6)]',
  code:           'text-[#C41230] font-mono text-sm',
  riskCard:       'bg-[rgba(17,17,17,0.03)] border-[rgba(0,0,0,0.2)]',
  riskTitle:      'text-[#111111]',
  riskDesc:       'text-[rgba(17,17,17,0.55)]',
} as const

function Section({ id, title, children, T }: {
  id: string
  title: string
  children: React.ReactNode
  T: typeof DARK | typeof LIGHT
}) {
  return (
    <section id={id} className="scroll-mt-20 mb-16">
      <h2 className={`font-display font-700 text-2xl mb-6 pb-3 border-b transition-colors duration-300 ${T.sectionTitle}`}>
        {title}
      </h2>
      <div className={`space-y-4 leading-relaxed font-serif transition-colors duration-300 ${T.bodyText}`}>{children}</div>
    </section>
  )
}

function InteractivePricingChart({ T }: { T: typeof DARK | typeof LIGHT }) {
  const mu = 100
  const sigma = 15
  const [strike, setStrike] = useState(100)

  const py = pYes(strike, mu, sigma)
  const pn = pNo(strike, mu, sigma)

  return (
    <div className={`border rounded p-5 space-y-4 not-italic transition-colors duration-300 ${T.miniChart}`}>
      <GaussianChart mu={mu} sigma={sigma} strikeX={strike} height={200} />
      <Slider
        value={strike}
        min={mu - 3 * sigma}
        max={mu + 3 * sigma}
        step={0.5}
        onChange={setStrike}
        label={`Strike: ${strike.toFixed(1)}`}
      />
      <div className="grid grid-cols-2 gap-4 text-center">
        <div className={`border rounded p-3 transition-colors duration-300 ${T.pYesBg}`}>
          <p className={`text-[10px] font-display tracking-widest uppercase mb-1 transition-colors duration-300 ${T.pYesLabel}`}>P(YES)</p>
          <p className={`font-mono text-xl transition-colors duration-300 ${T.pYesVal}`}>{(py * 100).toFixed(2)}%</p>
          <p className={`text-xs font-mono mt-0.5 transition-colors duration-300 ${T.pFormula}`}>
            1 − CDF({strike.toFixed(0)}, μ, σ)
          </p>
        </div>
        <div className={`border rounded p-3 transition-colors duration-300 ${T.pNoBg}`}>
          <p className={`text-[10px] font-display tracking-widest uppercase mb-1 transition-colors duration-300 ${T.pNoLabel}`}>P(NO)</p>
          <p className={`font-mono text-xl transition-colors duration-300 ${T.pNoVal}`}>{(pn * 100).toFixed(2)}%</p>
          <p className={`text-xs font-mono mt-0.5 transition-colors duration-300 ${T.pFormula}`}>
            CDF({strike.toFixed(0)}, μ, σ)
          </p>
        </div>
      </div>
    </div>
  )
}

export default function Docs() {
  const { isDark } = useTheme()
  const T = isDark ? DARK : LIGHT

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#0A0A0A]' : 'bg-[#F3EFE8]'}`}>
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex gap-10">
      {/* Sticky sidebar */}
      <aside className="hidden lg:block w-52 flex-shrink-0">
        <div className="sticky top-24">
          <p className={`text-[10px] font-display tracking-widest uppercase mb-4 transition-colors duration-300 ${T.sidebarLabel}`}>
            Contents
          </p>
          <nav className="space-y-0.5">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`block px-3 py-2 text-xs font-display rounded transition-colors duration-200 ${T.sidebarLink}`}
              >
                {s.label}
              </a>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <div className="mb-12">
          <h1 className={`font-display font-800 text-4xl tracking-tight mb-3 transition-colors duration-300 ${T.docTitle}`}>
            Documentation
          </h1>
          <p className={`font-serif italic text-lg transition-colors duration-300 ${T.docSubtitle}`}>
            How OmniCurve works, from first principles to contract architecture.
          </p>
        </div>

        <Section id="problem" title="The Problem" T={T}>
          <p>
            Traditional prediction markets create discrete binary pools: "Will BTC hit $100k? Yes/No." Each
            price point needs its own pool — fragmenting liquidity across hundreds of separate markets.
          </p>
          <p>
            A market-maker offering prices at $90k, $95k, $100k, $105k, and $110k needs five separate pools,
            each with its own liquidity providers and depth. This means capital is locked up inefficiently,
            and thin pools produce poor price discovery.
          </p>
        </Section>

        <Section id="solution" title="The Solution" T={T}>
          <p>
            OmniCurve replaces N binary pools with a single pool governed by a{' '}
            <strong className={`transition-colors duration-300 ${T.strong}`}>Gaussian probability distribution</strong>. One pool serves
            all strike prices simultaneously.
          </p>
          <div className="not-italic my-6">
            <GaussianChart mu={100} sigma={15} height={180} mini />
          </div>
          <p>
            Liquidity providers deposit once into the single pool and earn fees from all strikes. The
            distribution's mean (μ) represents the market's expected outcome, and sigma (σ) represents
            uncertainty. Both are set by LPs.
          </p>
        </Section>

        <Section id="pricing" title="How Pricing Works" T={T}>
          <p>
            The probability of any outcome is derived from the cumulative distribution function (CDF) of
            the Gaussian distribution:
          </p>
          <div className={`not-italic my-4 p-4 border rounded font-mono text-sm transition-colors duration-300 ${T.codeBlock}`}>
            <p className={`transition-colors duration-300 ${T.codeYes}`}>P_YES(x) = 1 − CDF(x, μ, σ)</p>
            <p className={`mt-2 transition-colors duration-300 ${T.codeNo}`}>P_NO(x) = CDF(x, μ, σ)</p>
          </div>
          <p>
            Drag the slider below to see how the strike price changes the probability split between YES and NO:
          </p>
          <div className="my-6">
            <InteractivePricingChart T={T} />
          </div>
          <p>
            The CDF is computed entirely on-chain using an Abramowitz & Stegun 5-coefficient error function
            approximation, providing ~11 significant digits of precision with fixed-point (WAD, 1e18) arithmetic.
          </p>
        </Section>

        <Section id="traders" title="For Traders" T={T}>
          <p>
            To trade on a market, choose a <strong className={`transition-colors duration-300 ${T.strong}`}>strike price</strong> and a
            direction: <span className={`transition-colors duration-300 ${T.yesText}`}>YES</span> (outcome exceeds strike) or{' '}
            <span className={`transition-colors duration-300 ${T.noText}`}>NO</span> (outcome at or below strike).
          </p>
          <p>
            You pay USDC proportional to the probability. If the market resolves in your direction, you
            can redeem your tokens 1:1 for USDC. A 1% fee is deducted from each trade and distributed
            to liquidity providers.
          </p>
          <p>
            Settlement is currently manual — the market owner calls <code className={`transition-colors duration-300 ${T.code}`}>settleByPrice(finalPrice)</code>.
            A two-phase resolution with a 24-hour timelock provides a dispute window.
          </p>
        </Section>

        <Section id="lps" title="For Liquidity Providers" T={T}>
          <p>
            Deposit USDC into a market's AMM contract to receive non-transferable LP tokens representing
            your share of the pool. Before the first trade, you can also set the distribution parameters
            (μ, σ) to shift the market's expected outcome.
          </p>
          <p>
            Fees from all trades are distributed to LPs using a{' '}
            <strong className={`transition-colors duration-300 ${T.strong}`}>MasterChef-style accumulator</strong>: a global
            acc_fee_per_share value increases with each trade, and each LP's pending fees = their shares
            × acc_fee_per_share − their reward_debt.
          </p>
          <p>
            LP tokens are non-transferable by design — this simplifies fee accounting and prevents
            complex reward_debt migration logic.
          </p>
        </Section>

        <Section id="architecture" title="Architecture" T={T}>
          <p>
            OmniCurve contracts are written in <strong className={`transition-colors duration-300 ${T.strong}`}>Rust</strong> and
            compiled to <strong className={`transition-colors duration-300 ${T.strong}`}>WASM</strong> using{' '}
            <strong className={`transition-colors duration-300 ${T.strong}`}>Arbitrum Stylus SDK v0.10.7</strong>.
          </p>
          <p>
            Each market deploys three <strong className={`transition-colors duration-300 ${T.strong}`}>EIP-1167 minimal proxy</strong>{' '}
            contracts via CREATE2: an AMM, a Router, and an LP Token. All proxies delegate to singleton
            implementation contracts, sharing code while maintaining independent storage.
          </p>
          <div className={`not-italic my-4 p-4 border rounded font-mono text-xs space-y-1 transition-colors duration-300 ${T.codeBox}`}>
            <p>OmniCurveFactory</p>
            <p className="pl-4">├── AMM Implementation (singleton)</p>
            <p className="pl-4">├── Router Implementation (singleton)</p>
            <p className="pl-4">└── Market #N</p>
            <p className="pl-8">├── AMM Proxy ──DELEGATECALL──▶ AMM Impl</p>
            <p className="pl-8">└── Router Proxy ──DELEGATECALL──▶ Router Impl</p>
          </div>
        </Section>

        <Section id="risks" title="Known Risks" T={T}>
          <div className="not-italic space-y-3">
            {[
              {
                level: 'High',
                color: isDark ? '#FF4560' : '#dc2626',
                title: 'claim_fees WAD bug',
                desc: 'The claimFees function sends WAD amounts as USDC (missing /1e12 conversion). Trading fees may be permanently locked in the contract.',
              },
              {
                level: 'High',
                color: isDark ? '#FF4560' : '#dc2626',
                title: 'Manual oracle',
                desc: 'Resolution is fully manual — the market owner calls settleByPrice(). There is no on-chain price oracle or automation.',
              },
              {
                level: 'Medium',
                color: isDark ? '#C41230' : '#B91C1C',
                title: 'No slippage protection',
                desc: 'Trades have no maximum cost parameter. In theory, a price manipulation could result in overpayment.',
              },
              {
                level: 'Medium',
                color: isDark ? '#C41230' : '#B91C1C',
                title: 'Non-upgradeable proxies',
                desc: 'EIP-1167 proxies cannot be upgraded. If a bug is found, a new market must be created and liquidity manually migrated.',
              },
            ].map((r) => (
              <div
                key={r.title}
                className={`flex gap-3 p-4 border rounded transition-colors duration-300 ${T.riskCard}`}
              >
                <span
                  className="text-xs font-mono px-2 py-0.5 rounded self-start flex-shrink-0 mt-0.5"
                  style={{ color: r.color, background: `${r.color}18`, border: `1px solid ${r.color}33` }}
                >
                  {r.level}
                </span>
                <div>
                  <p className={`font-display font-600 text-sm mb-1 transition-colors duration-300 ${T.riskTitle}`}>{r.title}</p>
                  <p className={`text-sm transition-colors duration-300 ${T.riskDesc}`}>{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </main>
    </div>
    </div>
  )
}
