import { useState, useCallback } from 'react'
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { maxUint256, type PublicClient } from 'viem'
import { USDC_ADDRESS, USDC_ABI, AMM_ABI } from '@/config/contracts'
import { floatToWad } from '@/lib/math'
import { estimateGasLimit, getGasFees } from '@/lib/gas'

export type LPStep = 'idle' | 'approving' | 'accepting' | 'seeding' | 'submitting' | 'confirmed' | 'error'

interface UseLPOptions {
  marketId: string
  ammAddress: string
}

/** Initial μ/σ for an unseeded market — applied via setDistribution (owner only). */
export interface SeedParams {
  mu: number
  sigma: number
}

// Storage slot of `pending_owner` in DistributionAmm (no public getter exists):
// 0 owner, 1 pending_owner, 2 global_mu, 3 global_sigma, 4 sigma_min.
const PENDING_OWNER_SLOT = '0x1'

async function waitMined(publicClient: PublicClient, hash: `0x${string}`, label: string) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status === 'reverted') {
    throw new Error(`${label} transaction reverted on-chain (tx ${hash})`)
  }
  return receipt
}

export function useLP({ marketId, ammAddress }: UseLPOptions) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<LPStep>('idle')
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [error, setError] = useState<Error | undefined>()

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: [address!, ammAddress as `0x${string}`],
    query: { enabled: !!address },
  })

  const { writeContractAsync } = useWriteContract()

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['market', marketId] })
    queryClient.invalidateQueries({ queryKey: ['markets'] })
    queryClient.invalidateQueries({ queryKey: ['portfolio'] })
    queryClient.invalidateQueries({ queryKey: ['lp-stats', marketId] })
    queryClient.invalidateQueries({ queryKey: ['amm-seed-state', ammAddress] })
  }, [queryClient, marketId, ammAddress])

  const writeAmm = useCallback(
    async (functionName: string, args: readonly unknown[]) => {
      const gasFees = await getGasFees(publicClient)
      const gas = await estimateGasLimit(publicClient, {
        address: ammAddress as `0x${string}`,
        abi: AMM_ABI,
        functionName,
        args,
        account: address!,
      })
      return writeContractAsync({
        address: ammAddress as `0x${string}`,
        abi: AMM_ABI,
        functionName,
        args,
        ...gasFees,
        gas,
      })
    },
    [address, ammAddress, publicClient, writeContractAsync],
  )

  /**
   * Seed the curve on an unseeded market, when the connected wallet can.
   * The Factory hands ownership over via a two-step transfer, so the creator
   * may still be `pending_owner` — accept first, then setDistribution.
   * LP deposits themselves never move the curve (the contract ignores the
   * addLiquidity μ/σ args), so seeding MUST go through setDistribution.
   */
  const seedCurveIfNeeded = useCallback(
    async (seed: SeedParams) => {
      const amm = ammAddress as `0x${string}`
      const sigmaOnChain = (await publicClient!.readContract({
        address: amm,
        abi: AMM_ABI,
        functionName: 'globalSigma',
      })) as bigint
      if (sigmaOnChain > 0n) return // already seeded — nothing to do

      const owner = (await publicClient!.readContract({
        address: amm,
        abi: AMM_ABI,
        functionName: 'owner',
      })) as string

      if (owner.toLowerCase() !== address!.toLowerCase()) {
        const pendingRaw = await publicClient!.getStorageAt({ address: amm, slot: PENDING_OWNER_SLOT })
        const pendingOwner = pendingRaw ? `0x${pendingRaw.slice(-40)}` : ''
        if (pendingOwner.toLowerCase() !== address!.toLowerCase()) {
          // Not the creator — deposit proceeds as pure collateral, unseeded.
          return
        }
        setStep('accepting')
        const acceptTx = await writeAmm('acceptOwnership', [])
        await waitMined(publicClient!, acceptTx, 'acceptOwnership')
      }

      setStep('seeding')
      const seedTx = await writeAmm('setDistribution', [floatToWad(seed.mu), floatToWad(seed.sigma)])
      await waitMined(publicClient!, seedTx, 'setDistribution')
    },
    [address, ammAddress, publicClient, writeAmm],
  )

  const add = useCallback(
    async (amountUsdc: number, seed?: SeedParams) => {
      if (!address) return
      setError(undefined)
      try {
        const amountWad = floatToWad(amountUsdc)
        const currentAllowance = allowance ?? 0n
        // allowance is in raw USDC units (6 decimals) — compare like for like
        const costUsdc = BigInt(Math.round(amountUsdc * 1e6))

        if (currentAllowance < costUsdc) {
          setStep('approving')
          const gasFees = await getGasFees(publicClient)
          const approveTx = await writeContractAsync({
            address: USDC_ADDRESS,
            abi: USDC_ABI,
            functionName: 'approve',
            args: [ammAddress as `0x${string}`, maxUint256],
            ...gasFees,
          })
          await waitMined(publicClient!, approveTx, 'USDC approve')
          await refetchAllowance()
        }

        if (seed) {
          await seedCurveIfNeeded(seed)
        }

        setStep('submitting')
        // target_mu / target_sigma are ignored by the contract (LPs are
        // curve-neutral) — pass zeros for ABI compatibility.
        const tx = await writeAmm('addLiquidity', [amountWad, 0n, 0n])
        setTxHash(tx)
        // Wait for the deposit to mine — refetching on submit would see pre-deposit state
        await waitMined(publicClient!, tx, 'addLiquidity')
        setStep('confirmed')
        invalidate()
      } catch (e) {
        console.error('[useLP.add] failed:', e)
        setError(e instanceof Error ? e : new Error('Transaction failed'))
        setStep('error')
      }
    },
    [address, allowance, ammAddress, writeContractAsync, writeAmm, seedCurveIfNeeded, refetchAllowance, invalidate, publicClient],
  )

  const remove = useCallback(
    async (sharesWad: bigint) => {
      if (!address) return
      setError(undefined)
      try {
        setStep('submitting')
        const tx = await writeAmm('removeLiquidity', [sharesWad])
        setTxHash(tx)
        await waitMined(publicClient!, tx, 'removeLiquidity')
        setStep('confirmed')
        invalidate()
      } catch (e) {
        console.error('[useLP.remove] failed:', e)
        setError(e instanceof Error ? e : new Error('Transaction failed'))
        setStep('error')
      }
    },
    [address, writeAmm, invalidate, publicClient],
  )

  const claim = useCallback(async () => {
    if (!address) return
    setError(undefined)
    try {
      setStep('submitting')
      const tx = await writeAmm('claimFees', [])
      setTxHash(tx)
      await waitMined(publicClient!, tx, 'claimFees')
      setStep('confirmed')
      invalidate()
    } catch (e) {
      console.error('[useLP.claim] failed:', e)
      setError(e instanceof Error ? e : new Error('Transaction failed'))
      setStep('error')
    }
  }, [address, writeAmm, invalidate, publicClient])

  const reset = useCallback(() => {
    setStep('idle')
    setTxHash(undefined)
    setError(undefined)
  }, [])

  return { step, add, remove, claim, reset, txHash, error }
}
