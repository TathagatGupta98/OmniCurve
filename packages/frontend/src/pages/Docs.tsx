import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform, MotionValue } from 'framer-motion'
import { GaussianChart } from '@/components/market/GaussianChart'
import { Slider } from '@/components/ui/Slider'
import { pYes, pNo } from '@/lib/math'

/* ════════════════════════════════════════════════════════════════════════
   Stage geometry — fixed viewBox, ETH-price domain matching Market #0
   (prior μ=3500 σ=800; the verified on-chain trade: 2 USDC YES @ 3000
   moved μ 3500 → 3358 and σ 800 → 714).
   ════════════════════════════════════════════════════════════════════════ */

const VB_W = 1000
const VB_H = 560
const PLOT = { left: 70, right: 70, top: 70, bottom: 90 }
const PW = VB_W - PLOT.left - PLOT.right
const PH = VB_H - PLOT.top - PLOT.bottom
const BASE_Y = VB_H - PLOT.bottom
const DOMAIN: [number, number] = [600, 6400]
const PEAK = 0.86

const BET_X = 3000
const FINAL_X = 3200
const PRIOR_MU = 3500
const PRIOR_SIGMA = 800

const xToPx = (x: number) => PLOT.left + ((x - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0])) * PW
const yToPx = (v: number) => BASE_Y - v * PH

const bell = (x: number, mu: number, sigma: number) => {
  const z = (x - mu) / sigma
  return Math.exp(-0.5 * z * z)
}

function linePath(mu: number, sigma: number, peak: number): string {
  const n = 120
  let d = ''
  for (let i = 0; i <= n; i++) {
    const x = DOMAIN[0] + ((DOMAIN[1] - DOMAIN[0]) * i) / n
    d += `${i === 0 ? 'M' : 'L'}${xToPx(x).toFixed(1)},${yToPx(bell(x, mu, sigma) * peak).toFixed(1)}`
  }
  return d
}

function areaPath(mu: number, sigma: number, peak: number, from: number, to: number): string {
  const lo = Math.max(DOMAIN[0], Math.min(from, to))
  const hi = Math.min(DOMAIN[1], Math.max(from, to))
  if (hi - lo < 1) return ''
  const n = 80
  let d = `M${xToPx(lo).toFixed(1)},${BASE_Y}`
  for (let i = 0; i <= n; i++) {
    const x = lo + ((hi - lo) * i) / n
    d += `L${xToPx(x).toFixed(1)},${yToPx(bell(x, mu, sigma) * peak).toFixed(1)}`
  }
  return d + `L${xToPx(hi).toFixed(1)},${BASE_Y}Z`
}

const X_TICKS = [1000, 2000, 3000, 4000, 5000, 6000]

/* ── Fragmented binary pools (chapter 01) ───────────────────────────────── */

const FRAGMENTS = [
  { x: 2300, h: 0.3 },
  { x: 2900, h: 0.48 },
  { x: 3500, h: 0.58 },
  { x: 4100, h: 0.46 },
  { x: 4700, h: 0.34 },
  { x: 5300, h: 0.24 },
  { x: 5900, h: 0.18 },
]

function FragmentBar({ t, x, h, i }: { t: MotionValue<number>; x: number; h: number; i: number }) {
  const inS = 0.02 + i * 0.013
  const opacity = useTransform(t, [inS, inS + 0.035, 0.115, 0.165], [0, 1, 1, 0])
  const y = useTransform(t, [inS, inS + 0.05], [18, 0])
  const py = pYes(x, PRIOR_MU, PRIOR_SIGMA)
  const total = h * PH
  const noH = total * (1 - py)
  const yesH = total * py
  const bx = xToPx(x) - 18

  return (
    <motion.g style={{ opacity, y }}>
      <rect
        x={bx} y={BASE_Y - noH} width={36} height={noH}
        fill="rgba(180,35,24,0.25)" stroke="rgba(180,35,24,0.55)" strokeWidth={1}
      />
      <rect
        x={bx} y={BASE_Y - noH - 3 - yesH} width={36} height={yesH}
        fill="rgba(11,122,82,0.25)" stroke="rgba(11,122,82,0.55)" strokeWidth={1}
      />
      <text
        x={bx + 18} y={BASE_Y - noH - yesH - 12} textAnchor="middle"
        fontSize={10} fontFamily="'JetBrains Mono', monospace" fill="var(--chart-tick-text)"
      >
        Y/N
      </text>
    </motion.g>
  )
}

/* ── Crossfading caption (one per chapter) ──────────────────────────────── */

function Caption({
  t, win, num, title, children, foot,
}: {
  t: MotionValue<number>
  win: [number, number, number, number]
  num: string
  title: string
  children: React.ReactNode
  foot?: string
}) {
  const opacity = useTransform(t, win, [0, 1, 1, 0])
  const y = useTransform(t, win, [28, 0, 0, -18])

  return (
    <motion.div
      style={{ opacity, y, background: '#FDF8EE', boxShadow: '0 10px 32px rgba(62,44,30,0.14)' }}
      className="absolute left-4 right-4 bottom-6 sm:left-10 sm:right-auto sm:bottom-10 sm:max-w-md border border-[rgba(62,44,30,0.18)] rounded p-5 sm:p-6 pointer-events-none"
    >
      <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#C8102E] mb-2">
        {num}
      </p>
      <h3 className="font-display font-700 text-lg sm:text-xl mb-2 text-[#231812]">
        {title}
      </h3>
      <p className="font-serif text-sm sm:text-[15px] leading-relaxed text-[rgba(35,24,18,0.85)]">
        {children}
      </p>
      {foot && (
        <p className="font-mono text-[10px] leading-relaxed mt-3 pt-3 border-t border-[rgba(62,44,30,0.14)] text-[rgba(35,24,18,0.62)]">
          {foot}
        </p>
      )}
    </motion.div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   The pinned scroll story — six chapters on one morphing Gaussian stage
   ════════════════════════════════════════════════════════════════════════ */

function ScrollStory() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress: t } = useScroll({ target: ref, offset: ['start start', 'end end'] })

  /* — curve state, scroll-driven — */
  const mu = useTransform(t, [0, 0.66, 0.745, 1], [PRIOR_MU, PRIOR_MU, 3358, 3358])
  const sigma = useTransform(
    t,
    [0, 0.24, 0.3, 0.36, 0.41, 0.66, 0.745, 1],
    [PRIOR_SIGMA, PRIOR_SIGMA, 1150, 580, PRIOR_SIGMA, PRIOR_SIGMA, 714, 714],
  )
  const peak = useTransform(t, [0.115, 0.2], [0, PEAK])
  const curveOpacity = useTransform(t, [0.115, 0.19], [0, 1])

  const strike = useTransform(t, [0.43, 0.545, 0.565, 0.615], [1300, 5300, 5300, BET_X])
  const strikeOpacity = useTransform(t, [0.4, 0.44], [0, 1])

  /* — derived SVG paths — */
  const curveD = useTransform([mu, sigma, peak], (v: number[]) => linePath(v[0], v[1], v[2]))
  const noAreaD = useTransform([mu, sigma, peak, strike], (v: number[]) =>
    areaPath(v[0], v[1], v[2], DOMAIN[0], v[3]),
  )
  const yesAreaD = useTransform([mu, sigma, peak, strike], (v: number[]) =>
    areaPath(v[0], v[1], v[2], v[3], DOMAIN[1]),
  )

  /* — markers — */
  const muPx = useTransform(mu, xToPx)
  const strikePx = useTransform(strike, xToPx)
  const muLineO = useTransform(t, [0.19, 0.23], [0, 1])
  const sigmaIndO = useTransform(t, [0.24, 0.27, 0.385, 0.415], [0, 1, 1, 0])
  const sigmaX1 = useTransform([mu, sigma], (v: number[]) => xToPx(v[0] - v[1]))
  const sigmaX2 = useTransform([mu, sigma], (v: number[]) => xToPx(v[0] + v[1]))

  /* — the bet (chapter 05) — */
  const betR = useTransform(t, [0.625, 0.655], [0, 7])
  const ringR = useTransform(t, [0.625, 0.7], [4, 30])
  const ringO = useTransform(t, [0.62, 0.632, 0.7], [0, 0.7, 0])
  const betLabelO = useTransform(t, [0.63, 0.665], [0, 1])
  const betCy = useTransform([mu, sigma], (v: number[]) => yToPx(bell(BET_X, v[0], v[1]) * PEAK))
  const curveChipO = useTransform(t, [0.7, 0.755, 0.8, 0.84], [0, 1, 1, 0])

  /* — settlement (chapter 06) — */
  const finalO = useTransform(t, [0.8, 0.85], [0, 1])
  const verdictO = useTransform(t, [0.86, 0.92], [0, 1])
  const verdictY = useTransform(t, [0.86, 0.92], [12, 0])

  /* — HUD readouts — */
  const hudO = useTransform(t, [0.19, 0.23], [0, 1])
  const muText = useTransform(mu, (v) => Math.round(v).toLocaleString())
  const sigmaText = useTransform(sigma, (v) => Math.round(v).toLocaleString())
  const strikeText = useTransform(strike, (v) => Math.round(v).toLocaleString())
  const pYesText = useTransform([strike, mu, sigma], (v: number[]) =>
    `${(pYes(v[0], v[1], v[2]) * 100).toFixed(1)}%`,
  )
  const pNoText = useTransform([strike, mu, sigma], (v: number[]) =>
    `${(pNo(v[0], v[1], v[2]) * 100).toFixed(1)}%`,
  )

  const phaseText = useTransform(t, (v): string => {
    if (v < 0.15) return '01 — FRAGMENTATION'
    if (v < 0.24) return '02 — THE COLLAPSE'
    if (v < 0.4) return '03 — BELIEF, DRAWN'
    if (v < 0.62) return '04 — PRICE = AREA'
    if (v < 0.79) return '05 — SKIN IN THE GAME'
    return '06 — REALITY SETTLES'
  })

  return (
    <div ref={ref} className="relative h-[620vh]">
      <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-hidden flex items-start justify-center lg:justify-end px-1 lg:pr-12">
        {/* the stage — top-aligned and right-shifted on desktop so the
            caption card (bottom-left) never covers the curve */}
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full max-w-6xl h-[78%] mt-4 px-2"
        >
          {/* baseline + ticks */}
          <line x1={PLOT.left} x2={VB_W - PLOT.right} y1={BASE_Y} y2={BASE_Y} stroke="var(--chart-axis)" strokeWidth={1} />
          {X_TICKS.map((v) => (
            <g key={v}>
              <line x1={xToPx(v)} x2={xToPx(v)} y1={BASE_Y} y2={BASE_Y + 5} stroke="var(--chart-axis)" strokeWidth={1} />
              <text
                x={xToPx(v)} y={BASE_Y + 22} textAnchor="middle"
                fontSize={11} fontFamily="'JetBrains Mono', monospace" fill="var(--chart-tick-text)"
              >
                ${v / 1000}k
              </text>
            </g>
          ))}

          {/* chapter 01 — fragmented binary pools */}
          {FRAGMENTS.map((f, i) => (
            <FragmentBar key={f.x} t={t} x={f.x} h={f.h} i={i} />
          ))}

          {/* YES / NO areas (appear with the strike) */}
          <motion.path d={noAreaD} style={{ opacity: strikeOpacity }} fill="rgba(180,35,24,0.13)" />
          <motion.path d={yesAreaD} style={{ opacity: strikeOpacity }} fill="rgba(11,122,82,0.13)" />

          {/* the omni-curve */}
          <motion.path
            d={curveD}
            style={{ opacity: curveOpacity, filter: 'drop-shadow(0 0 7px rgba(200,16,46,0.45))' }}
            fill="none"
            stroke="var(--chart-curve)"
            strokeWidth={2.5}
          />

          {/* μ marker */}
          <motion.line
            x1={muPx} x2={muPx} y1={92} y2={BASE_Y}
            style={{ opacity: muLineO }}
            stroke="rgba(200,16,46,0.55)" strokeWidth={1} strokeDasharray="4 3"
          />
          <motion.text
            x={muPx} dx={7} y={104}
            style={{ opacity: muLineO }}
            fontSize={13} fontFamily="'JetBrains Mono', monospace" fill="#C8102E"
          >
            μ
          </motion.text>

          {/* ±σ ruler (chapter 03) */}
          <motion.g style={{ opacity: sigmaIndO }}>
            <motion.line x1={sigmaX1} x2={sigmaX2} y1={300} y2={300} stroke="#C8102E" strokeWidth={1} strokeDasharray="2 3" />
            <motion.line x1={sigmaX1} x2={sigmaX1} y1={293} y2={307} stroke="#C8102E" strokeWidth={1} />
            <motion.line x1={sigmaX2} x2={sigmaX2} y1={293} y2={307} stroke="#C8102E" strokeWidth={1} />
            <motion.text
              x={muPx} y={290} textAnchor="middle"
              fontSize={11} fontFamily="'JetBrains Mono', monospace" fill="#C8102E"
            >
              ±σ
            </motion.text>
          </motion.g>

          {/* strike line (chapter 04 onward) */}
          <motion.line
            x1={strikePx} x2={strikePx} y1={90} y2={BASE_Y}
            style={{ opacity: strikeOpacity }}
            stroke="#C8102E" strokeWidth={1.5}
          />
          <motion.text
            x={strikePx} dx={-8} y={120} textAnchor="end"
            style={{ opacity: strikeOpacity }}
            fontSize={11} fontFamily="'JetBrains Mono', monospace" fill="var(--accent-no)"
          >
            NO ←
          </motion.text>
          <motion.text
            x={strikePx} dx={8} y={120}
            style={{ opacity: strikeOpacity }}
            fontSize={11} fontFamily="'JetBrains Mono', monospace" fill="var(--accent-yes)"
          >
            → YES
          </motion.text>

          {/* the bet lands (chapter 05) — dot glued to the curve at its strike */}
          <motion.circle
            cx={xToPx(BET_X)} cy={betCy} r={ringR}
            style={{ opacity: ringO }}
            fill="none" stroke="var(--accent-yes)" strokeWidth={1.5}
          />
          <motion.circle
            cx={xToPx(BET_X)} cy={betCy} r={betR}
            style={{ opacity: betLabelO }}
            fill="var(--accent-yes)"
          />
          <motion.text
            x={xToPx(BET_X)} dx={-10} y={170} textAnchor="end"
            style={{ opacity: betLabelO }}
            fontSize={11} fontFamily="'JetBrains Mono', monospace" fill="var(--accent-yes)"
          >
            +2 USDC · YES @ $3,000
          </motion.text>

          {/* settlement — observed final price, not μ (chapter 06) */}
          <motion.g style={{ opacity: finalO }}>
            <line
              x1={xToPx(FINAL_X)} x2={xToPx(FINAL_X)} y1={80} y2={BASE_Y}
              stroke="#0E7490" strokeWidth={1.5} strokeDasharray="2 3"
            />
            <text
              x={xToPx(FINAL_X)} dx={6} y={92}
              fontSize={11} fontFamily="'JetBrains Mono', monospace" fill="#0E7490"
            >
              final_price $3,200
            </text>
          </motion.g>
        </svg>

        {/* phase indicator — top left */}
        <div
          className="absolute top-5 left-4 sm:left-10 pointer-events-none rounded px-3.5 py-2.5 border border-[rgba(62,44,30,0.16)]"
          style={{ background: 'rgba(253,248,238,0.94)', boxShadow: '0 6px 20px rgba(62,44,30,0.10)' }}
        >
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[rgba(35,24,18,0.60)]">
            How it works
          </p>
          <motion.p className="font-mono text-xs tracking-[0.2em] uppercase text-[#C8102E] mt-1.5">
            {phaseText}
          </motion.p>
        </div>

        {/* live HUD — top right */}
        <motion.div
          style={{ opacity: hudO, background: '#FDF8EE', boxShadow: '0 6px 20px rgba(62,44,30,0.10)' }}
          className="absolute top-5 right-4 sm:right-10 hidden sm:block border border-[rgba(62,44,30,0.18)] rounded px-4 py-3 font-mono text-xs pointer-events-none"
        >
          <div className="flex items-center gap-3 justify-between">
            <span className="text-[color:var(--text-subtle)]">μ</span>
            <motion.span className="text-[#C8102E]">{muText}</motion.span>
          </div>
          <div className="flex items-center gap-3 justify-between mt-1">
            <span className="text-[color:var(--text-subtle)]">σ</span>
            <motion.span className="text-[#C8102E]">{sigmaText}</motion.span>
          </div>
          <motion.div style={{ opacity: strikeOpacity }}>
            <div className="flex items-center gap-3 justify-between mt-2 pt-2 border-t border-[color:var(--border-dim)]">
              <span className="text-[color:var(--text-subtle)]">strike</span>
              <motion.span className="text-[color:var(--text-primary)]">{strikeText}</motion.span>
            </div>
            <div className="flex items-center gap-3 justify-between mt-1">
              <span className="text-[color:var(--text-subtle)]">P(YES)</span>
              <motion.span className="text-[color:var(--accent-yes)]">{pYesText}</motion.span>
            </div>
            <div className="flex items-center gap-3 justify-between mt-1">
              <span className="text-[color:var(--text-subtle)]">P(NO)</span>
              <motion.span className="text-[color:var(--accent-no)]">{pNoText}</motion.span>
            </div>
          </motion.div>
        </motion.div>

        {/* event chips — top center */}
        <motion.div
          style={{ opacity: curveChipO }}
          className="absolute top-16 sm:top-5 left-1/2 -translate-x-1/2 border border-[rgba(200,16,46,0.45)] bg-[rgba(200,16,46,0.10)] rounded px-3 py-1.5 font-mono text-[10px] tracking-[0.15em] uppercase text-[#C8102E] whitespace-nowrap pointer-events-none"
        >
          CurveUpdated · μ 3,500→3,358 · σ 800→714
        </motion.div>
        <motion.div
          style={{ opacity: verdictO, y: verdictY }}
          className="absolute top-16 sm:top-5 left-1/2 -translate-x-1/2 border border-[rgba(11,122,82,0.45)] bg-[rgba(11,122,82,0.10)] rounded px-3 py-1.5 font-mono text-[10px] tracking-[0.15em] uppercase text-[color:var(--accent-yes)] whitespace-nowrap pointer-events-none"
        >
          final 3,200 ≥ strike 3,000 → YES pays $1/token
        </motion.div>

        {/* scroll progress rail */}
        <div className="absolute right-1.5 sm:right-3 top-[12%] bottom-[12%] w-px bg-[color:var(--border-dim)]">
          <motion.div
            style={{ scaleY: t, transformOrigin: 'top' }}
            className="absolute inset-0 bg-[#C8102E]"
          />
        </div>

        {/* captions */}
        <Caption t={t} win={[0.02, 0.05, 0.115, 0.145]} num="01 / 06" title="Fragmentation">
          Today's prediction markets ask the same question over and over. Will ETH clear $2k?
          $3k? $4k? Every strike is its own yes/no pool — its own order book, its own thin
          slice of capital.
        </Caption>
        <Caption t={t} win={[0.15, 0.18, 0.21, 0.24]} num="02 / 06" title="The collapse">
          OmniCurve collapses every strike into one pool, governed by a single Gaussian
          curve. Liquidity is never fragmented again: one curve prices every outcome at once.
        </Caption>
        <Caption t={t} win={[0.25, 0.28, 0.37, 0.4]} num="03 / 06" title="Belief, drawn">
          The bell is the market's belief about one continuous outcome. μ is the consensus;
          σ is its uncertainty — wide when the market is unsure, tight as conviction builds.
        </Caption>
        <Caption t={t} win={[0.43, 0.46, 0.59, 0.62]} num="04 / 06" title="Price = area">
          Choose any strike x — not just a listed one. YES costs the area under the curve to
          the right of x; NO costs the area to the left. P(YES) = 1 − Φ((x−μ)/σ), computed
          entirely on-chain.
        </Caption>
        <Caption
          t={t}
          win={[0.645, 0.675, 0.765, 0.79]}
          num="05 / 06"
          title="Skin in the game"
          foot="Verified on-chain: this exact 2 USDC trade moved Market #0 on Arbitrum Sepolia."
        >
          Every bet folds its stake into the curve — a stake-weighted average of all strikes.
          Bettors move μ and σ; liquidity providers never can. Moving the market always costs
          capital at risk: manipulation-resistant by construction.
        </Caption>
        <Caption t={t} win={[0.815, 0.845, 0.96, 0.995]} num="06 / 06" title="Reality settles">
          μ is belief, never the verdict. The market settles against the observed final
          price: a YES at strike x pays $1 per token iff final ≥ x. Dragging the curve
          around can't change who wins.
        </Caption>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   Hero — self-drawing curve + invitation to scroll
   ════════════════════════════════════════════════════════════════════════ */

const HERO_CURVE = (() => {
  let d = ''
  for (let i = 0; i <= 100; i++) {
    const x = 20 + (680 * i) / 100
    const z = (x - 360) / 100
    const y = 198 - 168 * Math.exp(-0.5 * z * z)
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }
  return d
})()

function Hero() {
  return (
    <section className="relative min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-6 overflow-hidden">
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="font-mono text-[10px] sm:text-xs tracking-[0.4em] uppercase text-[#C8102E] mb-6"
      >
        Protocol Documentation
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="font-display font-800 tracking-tight leading-[0.95] text-center text-[color:var(--text-primary)]"
        style={{ fontSize: 'clamp(2.6rem, 7vw, 5.2rem)' }}
      >
        The market
        <br />
        is a curve.
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="font-serif italic text-base sm:text-lg max-w-lg text-center leading-relaxed mt-6 text-[color:var(--text-muted)]"
      >
        One Gaussian replaces a thousand binary pools. Scroll — and the protocol
        will explain itself.
      </motion.p>

      <svg viewBox="0 0 720 220" className="w-full max-w-2xl mt-10" fill="none">
        <motion.path
          d={HERO_CURVE}
          stroke="var(--chart-curve)"
          strokeWidth={2.5}
          style={{ filter: 'drop-shadow(0 0 7px rgba(200,16,46,0.45))' }}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.5, duration: 1.8, ease: 'easeInOut' }}
        />
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.1, duration: 0.6 }}
        >
          <line x1={360} x2={360} y1={34} y2={198} stroke="rgba(200,16,46,0.5)" strokeWidth={1} strokeDasharray="4 3" />
          <text x={368} y={46} fontSize={13} fontFamily="'JetBrains Mono', monospace" fill="#C8102E">μ</text>
          <line x1={20} x2={700} y1={198} y2={198} stroke="var(--chart-axis)" strokeWidth={1} />
        </motion.g>
      </svg>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.4, duration: 0.8 }}
        className="absolute bottom-8 flex flex-col items-center gap-2"
      >
        <span className="font-mono text-[10px] tracking-[0.35em] uppercase text-[color:var(--text-subtle)]">
          Scroll
        </span>
        <motion.span
          animate={{ y: [0, 7, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          className="block w-px h-8 bg-[#C8102E]"
        />
      </motion.div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   Below the story — reveal-on-scroll reference sections
   ════════════════════════════════════════════════════════════════════════ */

function Reveal({ children, delay = 0, className = '' }: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function SectionHead({ num, title, sub }: { num: string; title: string; sub?: string }) {
  return (
    <Reveal className="mb-10">
      <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#C8102E] mb-3">{num}</p>
      <h2 className="font-display font-800 text-3xl sm:text-4xl tracking-tight text-[color:var(--text-primary)]">
        {title}
      </h2>
      {sub && (
        <p className="font-serif italic text-base mt-3 max-w-xl text-[color:var(--text-muted)]">{sub}</p>
      )}
    </Reveal>
  )
}

/* ── 07 — interactive playground ────────────────────────────────────────── */

function Playground() {
  const mu = PRIOR_MU
  const sigma = PRIOR_SIGMA
  const [strike, setStrike] = useState(BET_X)

  const py = pYes(strike, mu, sigma)
  const pn = pNo(strike, mu, sigma)
  const stake = 100
  const yesTokens = py > 0.001 ? (stake * 0.99) / py : 0

  return (
    <Reveal>
      <div
        className="border border-[color:var(--border-dim)] rounded p-5 sm:p-7 space-y-5"
        style={{ background: 'var(--bg-surface)' }}
      >
        <GaussianChart mu={mu} sigma={sigma} strikeX={strike} height={230} />
        <Slider
          value={strike}
          min={mu - 3 * sigma}
          max={mu + 3 * sigma}
          step={10}
          onChange={setStrike}
          label="Strike price"
          displayValue={`$${strike.toLocaleString()}`}
        />
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="border border-[rgba(11,122,82,0.3)] bg-[rgba(11,122,82,0.07)] rounded p-4">
            <p className="text-[10px] font-mono tracking-[0.25em] uppercase mb-1 text-[color:var(--accent-yes)] opacity-70">
              P(YES)
            </p>
            <p className="font-mono text-2xl text-[color:var(--accent-yes)]">{(py * 100).toFixed(2)}%</p>
            <p className="text-[11px] font-mono mt-1 text-[color:var(--text-subtle)]">
              1 − Φ((x−μ)/σ)
            </p>
          </div>
          <div className="border border-[rgba(180,35,24,0.3)] bg-[rgba(180,35,24,0.07)] rounded p-4">
            <p className="text-[10px] font-mono tracking-[0.25em] uppercase mb-1 text-[color:var(--accent-no)] opacity-70">
              P(NO)
            </p>
            <p className="font-mono text-2xl text-[color:var(--accent-no)]">{(pn * 100).toFixed(2)}%</p>
            <p className="text-[11px] font-mono mt-1 text-[color:var(--text-subtle)]">
              Φ((x−μ)/σ)
            </p>
          </div>
        </div>
        <p className="font-mono text-xs text-center pt-1 text-[color:var(--text-subtle)]">
          $100 on YES @ ${strike.toLocaleString()} → ~{yesTokens.toFixed(1)} tokens (after 1% fee)
          → pays <span className="text-[color:var(--accent-yes)]">${yesTokens.toFixed(2)}</span> if
          final ≥ strike
        </p>
      </div>
    </Reveal>
  )
}

/* ── 08 — the math ──────────────────────────────────────────────────────── */

const MATH_PLATES = [
  {
    label: 'Pricing',
    lines: ['P_YES(x) = 1 − Φ((x − μ) / σ)', 'P_NO(x)  =     Φ((x − μ) / σ)'],
    note: 'Probability is area under the Gaussian. Any continuous strike gets an instant, mathematically derived price.',
  },
  {
    label: 'The curve',
    lines: ['μ = Σ wᵢ·xᵢ / Σ wᵢ', 'σ = √( Σ wᵢ·xᵢ² / Σ wᵢ − μ² )'],
    note: 'Each bet contributes weight wᵢ (its net stake) at strike xᵢ. The owner’s seed is just a prior with virtual weight that dilutes as real bets arrive.',
  },
  {
    label: 'On-chain stack',
    lines: ['erf ≈ Abramowitz–Stegun (err < 1.5e−7)', 'eˣ = 18-term Taylor · √ = Newton'],
    note: 'All of it in WAD (1e18) fixed-point I256 — ~11 significant digits, computed in Rust compiled to WASM on Arbitrum Stylus. No oracle does the math for us.',
  },
  {
    label: 'Fees',
    lines: ['pending = shares × accFeePerShare', '          − rewardDebt'],
    note: '1% of every trade flows to LPs through a MasterChef-style accumulator — O(1) distribution no matter how many providers.',
  },
]

/* ── 10 — resolution lifecycle ──────────────────────────────────────────── */

const LIFECYCLE = [
  {
    fn: 'set_final_price',
    title: 'Record reality',
    desc: 'The owner records the externally observed outcome. μ never settles anything — the real number does.',
  },
  {
    fn: 'propose_resolution',
    title: 'Open the window',
    desc: 'A resolution proposal starts a 24-hour timelock — a dispute window anyone can inspect.',
  },
  {
    fn: 'execute_resolution',
    title: 'Finalize',
    desc: 'After the timelock, the market resolves. Trading and liquidity operations stop.',
  },
  {
    fn: 'claim_winnings',
    title: 'Redeem',
    desc: 'Winners pull $1 per token. release_losing_collateral frees the LP capital locked behind losing bets.',
  },
]

export default function Docs() {
  return (
    <div className="overflow-x-clip">
      <Hero />
      <ScrollStory />

      {/* ── 07 / TRY IT ── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-28 pb-8">
        <SectionHead
          num="07 / Try it"
          title="Run your own strike"
          sub="The same CDF the contracts compute on-chain, live under your cursor. Drag the strike across Market #0's curve."
        />
        <Playground />
      </section>

      {/* ── 08 / THE MATH ── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-28 pb-8">
        <SectionHead
          num="08 / The math"
          title="Four formulas, no oracle"
          sub="Everything the protocol believes and charges reduces to these."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MATH_PLATES.map((p, i) => (
            <Reveal key={p.label} delay={i * 0.08}>
              <div
                className="border border-[color:var(--border-dim)] rounded p-5 h-full"
                style={{ background: 'var(--bg-surface)' }}
              >
                <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#C8102E] mb-3">
                  {p.label}
                </p>
                <div className="font-mono text-[13px] leading-relaxed whitespace-pre text-[color:var(--text-primary)] overflow-x-auto">
                  {p.lines.map((l) => (
                    <p key={l}>{l}</p>
                  ))}
                </div>
                <p className="font-serif text-sm leading-relaxed mt-4 text-[color:var(--text-muted)]">
                  {p.note}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── 09 / TWO ROLES ── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-28 pb-8">
        <SectionHead
          num="09 / Two roles"
          title="Bettors steer. LPs underwrite."
          sub="The separation is the security model: only capital at risk on a position can move the curve."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Reveal>
            <div
              className="border rounded p-6 h-full border-[rgba(11,122,82,0.3)]"
              style={{ background: 'var(--bg-surface)' }}
            >
              <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--accent-yes)] mb-4">
                Traders
              </p>
              <ol className="space-y-3.5">
                {[
                  'Pick any strike and a side — YES (final ≥ x) or NO (final < x).',
                  'Stake USDC. You pay the probability: cheap when the curve disagrees with you.',
                  'Your stake folds into the curve — your conviction moves μ and σ.',
                  'If reality lands your side of the strike, redeem $1.00 per token.',
                ].map((s, i) => (
                  <li key={s} className="flex gap-3">
                    <span className="font-mono text-xs text-[color:var(--accent-yes)] mt-0.5 flex-shrink-0">
                      0{i + 1}
                    </span>
                    <span className="font-serif text-sm leading-relaxed text-[color:var(--text-muted)]">
                      {s}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div
              className="border rounded p-6 h-full border-[rgba(200,16,46,0.35)]"
              style={{ background: 'var(--bg-surface)' }}
            >
              <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#C8102E] mb-4">
                Liquidity providers
              </p>
              <ol className="space-y-3.5">
                {[
                  'Deposit USDC into the single pool; receive non-transferable LP tokens.',
                  'Pure collateral underwriting — deposits never shift μ or σ, by construction.',
                  'Earn 1% of every trade across all strikes, pro-rata, claimable anytime.',
                  'After resolution, collateral locked behind losing bets returns to the pool.',
                ].map((s, i) => (
                  <li key={s} className="flex gap-3">
                    <span className="font-mono text-xs text-[#C8102E] mt-0.5 flex-shrink-0">
                      0{i + 1}
                    </span>
                    <span className="font-serif text-sm leading-relaxed text-[color:var(--text-muted)]">
                      {s}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 10 / RESOLUTION ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-28 pb-8">
        <SectionHead
          num="10 / Resolution"
          title="Settling against reality"
          sub="Pull-based claiming, with a timelock between proposal and finality."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {LIFECYCLE.map((s, i) => (
            <Reveal key={s.fn} delay={i * 0.1}>
              <div
                className="border border-[color:var(--border-dim)] rounded p-5 h-full relative"
                style={{ background: 'var(--bg-surface)' }}
              >
                <span className="font-mono text-[10px] text-[color:var(--text-subtle)]">
                  STEP 0{i + 1}
                </span>
                <p className="font-mono text-[13px] text-[#C8102E] mt-2 break-all">{s.fn}()</p>
                <p className="font-display font-600 text-sm mt-2 text-[color:var(--text-primary)]">
                  {s.title}
                </p>
                <p className="font-serif text-[13px] leading-relaxed mt-2 text-[color:var(--text-muted)]">
                  {s.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── 11 / ARCHITECTURE ── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-28 pb-8">
        <SectionHead
          num="11 / Architecture"
          title="Rust on Stylus, cloned per market"
          sub="The Gaussian engine would be prohibitively expensive in Solidity. Stylus runs it as WASM for near-zero gas."
        />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-stretch">
          <Reveal className="md:col-span-2">
            <div className="h-full flex flex-col justify-center space-y-4">
              <p className="font-serif text-[15px] leading-relaxed text-[color:var(--text-muted)]">
                Contracts are written in <strong className="text-[color:var(--text-primary)]">Rust</strong>,
                compiled to <strong className="text-[color:var(--text-primary)]">WASM</strong> with the
                Arbitrum Stylus SDK. Implementations deploy once as singletons; the Factory clones an
                AMM, a Router, and an LP Token per market via{' '}
                <strong className="text-[color:var(--text-primary)]">EIP-1167 minimal proxies</strong> and
                CREATE2 — shared code, independent storage.
              </p>
              <p className="font-serif text-[15px] leading-relaxed text-[color:var(--text-muted)]">
                The Router prices and executes trades, the AMM holds collateral and recomputes the
                curve, and the LP Token receipts the underwriters.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.12} className="md:col-span-3">
            <div
              className="border border-[color:var(--border-dim)] rounded p-5 font-mono text-xs leading-loose text-[color:var(--text-muted)] overflow-x-auto"
              style={{ background: 'var(--bg-surface)' }}
            >
              <p className="text-[#C8102E]">OmniCurveFactory.create_market()</p>
              <p className="pl-3">├─ AMM Proxy ──DELEGATECALL──▶ AMM Impl</p>
              <p className="pl-3">├─ Router Proxy ──DELEGATECALL──▶ Router Impl</p>
              <p className="pl-3">├─ LP Token Proxy ──DELEGATECALL──▶ LP Impl</p>
              <p className="pl-3">├─ wires AMM ↔ Router ↔ LP Token ↔ USDC</p>
              <p className="pl-3">└─ ownership → market creator (two-step)</p>
            </div>
          </Reveal>
        </div>
        <Reveal delay={0.2}>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-8 font-mono text-[10px] tracking-[0.15em] uppercase text-[color:var(--text-subtle)]">
            <span>Arbitrum Stylus</span>
            <span className="text-[#C8102E]">·</span>
            <span>Rust → WASM</span>
            <span className="text-[#C8102E]">·</span>
            <span>EIP-1167 + CREATE2</span>
            <span className="text-[#C8102E]">·</span>
            <span>WAD fixed-point</span>
            <span className="text-[#C8102E]">·</span>
            <span>MasterChef fees</span>
            <span className="text-[#C8102E]">·</span>
            <span>Non-custodial</span>
          </div>
        </Reveal>
      </section>

      {/* ── closing CTA ── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-28 pb-16">
        <Reveal>
          <div
            className="border border-[color:var(--border-dim)] rounded px-6 py-14 sm:py-16 text-center relative overflow-hidden"
            style={{ background: 'var(--bg-surface)' }}
          >
            <svg
              viewBox="0 0 720 220"
              className="absolute inset-x-0 bottom-0 w-full opacity-[0.15] pointer-events-none"
              preserveAspectRatio="xMidYMax slice"
              fill="none"
            >
              <path d={HERO_CURVE} stroke="#C8102E" strokeWidth={2} />
            </svg>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#C8102E] mb-4 relative">
              End of transmission
            </p>
            <h2 className="font-display font-800 text-3xl sm:text-4xl tracking-tight text-[color:var(--text-primary)] relative">
              Ready to price the future?
            </h2>
            <p className="font-serif italic text-base mt-4 max-w-md mx-auto text-[color:var(--text-muted)] relative">
              Market #0 is live on Arbitrum Sepolia: “What will ETH price be by the end of 2026?”
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8 relative">
              <Link
                to="/markets"
                className="inline-flex items-center justify-center px-8 py-3.5 bg-[#c8102e] text-white font-display font-700 text-sm tracking-wider rounded hover:bg-[#a5001b] active:scale-[0.98] transition-all"
                style={{ boxShadow: '0 0 28px rgba(200,16,46,0.35)' }}
              >
                Enter Markets →
              </Link>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="inline-flex items-center justify-center px-8 py-3.5 border border-[color:var(--border)] font-display font-600 text-sm tracking-wider rounded text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] hover:border-[#C8102E] transition-all"
              >
                Replay the story ↑
              </button>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
