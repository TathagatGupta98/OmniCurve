import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

const cn = (...args: Parameters<typeof clsx>) => twMerge(clsx(...args))

interface BadgeProps {
  variant?: 'yes' | 'no' | 'live' | 'resolved' | 'muted' | 'amber'
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'muted', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono rounded-sm tracking-wide',
        {
          'bg-[rgba(34,211,163,0.15)] text-[#22D3A3] border border-[rgba(34,211,163,0.45)]':
            variant === 'yes' || variant === 'live',
          'bg-[rgba(255,69,96,0.15)] text-[#dc2626] border border-[rgba(255,69,96,0.45)]':
            variant === 'no' || variant === 'resolved',
          'bg-[rgba(196,18,48,0.15)] text-[#C41230] border border-[rgba(196,18,48,0.45)]':
            variant === 'amber',
        },
        className,
      )}
      style={
        variant === 'muted'
          ? {
              background: 'var(--bg-surface-2)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
            }
          : undefined
      }
    >
      {variant === 'live' && (
        <span className="w-1.5 h-1.5 rounded-full bg-[#22D3A3] animate-pulse" />
      )}
      {children}
    </span>
  )
}
