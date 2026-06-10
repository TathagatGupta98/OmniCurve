import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useMarkets } from '@/hooks/useMarkets'
import { ConnectButton } from '@/components/wallet/ConnectButton'
import ShaderBackground from '@/components/ui/ShaderBackground'

export default function Landing() {
  const { data: markets } = useMarkets()

  const totalLiquidity = markets?.reduce((s, m) => s + m.totalLiquidity, 0) ?? 0
  const resolvedCount  = markets?.filter(m => m.isResolved).length ?? 0

  useEffect(() => {
    document.body.classList.add('shader-bg')
    return () => document.body.classList.remove('shader-bg')
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <ShaderBackground darkMode={true} />

      {/* ── Nav ── */}
      <header className="fixed top-0 left-0 right-0 z-40 px-6 h-14 flex items-center justify-between border-b backdrop-blur-md bg-[rgba(15,15,15,0.95)] border-[rgba(255,255,255,0.14)]">
        <span className="font-display font-800 text-sm tracking-wider text-[#F2F2F2]">
          OMNI<span className="text-[#C41230]">CURVE</span>
        </span>

        <div className="flex items-center gap-3">
          <Link
            to="/docs"
            className="text-xs font-display tracking-widest uppercase text-[rgba(242,242,242,0.65)] hover:text-[#F2F2F2] transition-colors duration-200"
          >
            Docs
          </Link>

          <ConnectButton />
        </div>
      </header>

      {/* ── Hero ── */}
      <main className="flex-1 flex flex-col items-center justify-center pt-14 px-6 relative">

        {/* Scrim — keeps text crisp over the shader animation */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(10,3,3,0.75) 0%, rgba(10,3,3,0.28) 60%, transparent 100%)',
          }}
        />

        <div className="w-full text-center relative z-10 flex flex-col items-center gap-8 py-24">

          <motion.h1
            className="font-display font-800 tracking-tight leading-none whitespace-nowrap text-white"
            style={{
              fontSize: 'clamp(2.4rem, 6.5vw, 5.5rem)',
              textShadow: '0 2px 32px rgba(8,2,2,0.98), 0 0 64px rgba(8,2,2,0.85)',
            }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            Every Outcome, One Curve
          </motion.h1>

          <motion.p
            className="font-serif italic text-base sm:text-lg max-w-md mx-auto leading-relaxed text-[rgba(255,245,244,0.80)]"
            style={{ textShadow: '0 1px 18px rgba(8,2,2,0.96)' }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.55 }}
          >
            One pool. Every strike price. Priced continuously by the Gaussian curve.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-3 justify-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.5 }}
          >
            <Link
              to="/markets"
              className="inline-flex items-center justify-center gap-2 px-9 py-4 bg-[#c8102e] text-white font-display font-700 text-sm tracking-wider rounded hover:bg-[#a5001b] active:scale-[0.98] transition-all"
              style={{ boxShadow: '0 0 32px rgba(200,16,46,0.4)' }}
            >
              Enter Markets →
            </Link>
            <Link
              to="/docs"
              className="inline-flex items-center justify-center gap-2 px-9 py-4 border font-display font-600 text-sm tracking-wider rounded transition-all border-[rgba(255,255,255,0.45)] text-[rgba(255,245,244,0.85)] hover:border-[rgba(255,255,255,0.70)] hover:text-white"
              style={{ backdropFilter: 'blur(8px)' }}
            >
              How It Works
            </Link>
          </motion.div>

          <motion.div
            className="grid grid-cols-3 gap-8 max-w-xs mx-auto pt-8 border-t border-[rgba(255,255,255,0.20)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6, duration: 0.6 }}
          >
            {[
              { value: markets?.length ?? 0,                    label: 'Markets'  },
              { value: `$${(totalLiquidity / 1e6).toFixed(0)}`, label: 'TVL'      },
              { value: resolvedCount,                            label: 'Resolved' },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <p
                  className="font-mono text-xl text-[#C41230]"
                  style={{ textShadow: '0 1px 18px rgba(8,2,2,0.96)' }}
                >
                  {value}
                </p>
                <p className="text-[9px] font-display tracking-widest uppercase mt-1 text-[rgba(255,245,244,0.55)]">
                  {label}
                </p>
              </div>
            ))}
          </motion.div>
        </div>
      </main>

      {/* ── Tech strip ── */}
      <div className="border-t py-4 px-6 border-[rgba(255,255,255,0.14)]">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-6 text-[10px] font-mono tracking-wider uppercase text-[rgba(255,245,244,0.45)]">
          <span>Arbitrum Stylus</span>
          <span>·</span>
          <span>Rust → WASM On-chain Math</span>
          <span>·</span>
          <span>Gaussian CDF Pricing</span>
          <span>·</span>
          <span>EIP-1167 Proxy Factory</span>
          <span>·</span>
          <span>Non-Custodial</span>
        </div>
      </div>
    </div>
  )
}
