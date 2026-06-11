import { ConnectButton as RainbowConnectButton } from '@rainbow-me/rainbowkit'
import { Button } from '@/components/ui/Button'
import { shortAddr } from '@/lib/math'

export function ConnectButton() {
  return (
    <RainbowConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted
        if (!ready) return null

        if (!account) {
          return (
            <Button variant="ghost" size="sm" onClick={openConnectModal}>
              Connect Wallet
            </Button>
          )
        }

        if (chain?.unsupported) {
          return (
            <Button variant="danger" size="sm" onClick={openChainModal}>
              Wrong Network
            </Button>
          )
        }

        return (
          <button
            onClick={openAccountModal}
            className="flex items-center gap-2 px-3 py-2 rounded border border-[rgba(62,44,30,0.08)] bg-[rgba(62,44,30,0.04)] hover:bg-[rgba(62,44,30,0.07)] transition-colors text-sm"
          >
            <span className="w-2 h-2 rounded-full bg-[#0B7A52]" />
            <span className="font-mono text-[#231812] text-xs">{shortAddr(account.address)}</span>
            {account.balanceFormatted && (
              <span className="font-mono text-[rgba(35,24,18,0.45)] text-xs hidden sm:block">
                {account.balanceFormatted.slice(0, 6)} ETH
              </span>
            )}
          </button>
        )
      }}
    </RainbowConnectButton.Custom>
  )
}
