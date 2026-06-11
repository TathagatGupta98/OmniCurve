import { NavLink, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ConnectButton } from '@/components/wallet/ConnectButton'

const navLinks = [
  { to: '/markets', label: 'Markets' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/docs', label: 'Docs' },
]

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b backdrop-blur-md bg-[rgba(15,15,15,0.96)] border-[rgba(255,255,255,0.14)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="4" fill="rgba(196,18,48,0.12)" />
            <path
              d="M4 24 Q8 8 16 8 Q24 8 28 24"
              stroke="#22D3A3"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="16" cy="8" r="2" fill="#C41230" />
            <line x1="16" y1="8" x2="16" y2="24" stroke="rgba(196,18,48,0.4)" strokeWidth="1" strokeDasharray="2 2" />
          </svg>
          <span className="font-display font-800 text-sm tracking-wider text-[#F2F2F2] group-hover:text-[#C41230] transition-colors duration-200">
            OMNI<span className="text-[#C41230]">CURVE</span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="hidden sm:flex items-center gap-1">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `relative px-4 py-2 text-xs font-display tracking-wider uppercase transition-colors duration-200 rounded ${
                  isActive
                    ? 'text-[#C41230]'
                    : 'text-[rgba(242,242,242,0.65)] hover:text-[#F2F2F2]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <motion.span
                    className="block"
                    whileHover={{ y: -1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    {link.label}
                  </motion.span>
                  {isActive && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute bottom-0.5 left-3 right-3 h-[1.5px] rounded-full bg-[#C41230]"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <ConnectButton />
      </div>
    </header>
  )
}
