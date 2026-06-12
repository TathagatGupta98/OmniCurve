import { useState, useCallback } from 'react'
import { parseEventLogs } from 'viem'
import { useAccount, useWriteContract, usePublicClient } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { FACTORY_ADDRESS, FACTORY_ABI, USDC_ADDRESS } from '@/config/contracts'
import { api } from '@/lib/api'
import { savePendingMeta, updatePendingMeta, removePendingMeta } from '@/lib/pendingMeta'
import { floatToWad } from '@/lib/math'
import { estimateGasLimit, getGasFees } from '@/lib/gas'

export type CreateStep = 'idle' | 'submitting' | 'confirmed' | 'error'

export function useCreateMarket() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const publicClient = usePublicClient()
  const { address } = useAccount()
  const [step, setStep] = useState<CreateStep>('idle')
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [error, setError] = useState<Error | undefined>()

  const { writeContractAsync } = useWriteContract()

  const create = useCallback(
    async (sigmaMin: number, meta?: { title: string; category?: string }) => {
      setError(undefined)
      try {
        setStep('submitting')
        // Reserve the question server-side before the tx: the backend's chain
        // watcher applies it on MarketCreated, so the title is stored even if
        // this browser flow dies after submission (RPC timeout, closed tab).
        if (meta?.title && address) {
          try {
            await api.reserveMarketMetadata(address, meta)
          } catch (reserveErr) {
            console.warn('[createMarket] could not reserve market title:', reserveErr)
          }
        }
        const sigmaMinWad = floatToWad(sigmaMin)
        const gasFees = await getGasFees(publicClient)
        // createMarket deploys 3 proxies + wiring — heavy, and MetaMask can't estimate
        // gas for the Stylus factory. Provide an explicit limit (generous fallback).
        const gas = address
          ? await estimateGasLimit(
              publicClient,
              {
                address: FACTORY_ADDRESS,
                abi: FACTORY_ABI,
                functionName: 'createMarket',
                args: [USDC_ADDRESS, sigmaMinWad],
                account: address,
              },
              6_000_000n,
            )
          : 6_000_000n
        const tx = await writeContractAsync({
          address: FACTORY_ADDRESS,
          abi: FACTORY_ABI,
          functionName: 'createMarket',
          args: [USDC_ADDRESS, sigmaMinWad],
          ...gasFees,
          gas,
        })
        setTxHash(tx)
        // Persist the question locally before anything else can fail, so a
        // failed metadata PATCH can be replayed on the next markets-page load
        // instead of leaving the market as "Market #N" forever.
        if (meta?.title) savePendingMeta({ txHash: tx, ...meta })
        // Wait for on-chain confirmation before marking done — catches reverts
        const receipt = await publicClient!.waitForTransactionReceipt({ hash: tx })
        if (receipt.status === 'reverted') {
          throw new Error('createMarket transaction reverted on-chain')
        }

        // The question/category live off-chain: pull the new market id from the
        // MarketCreated log and store the metadata in the backend so the market
        // shows its question instead of the "Market #N" placeholder.
        if (meta?.title) {
          try {
            const [created] = parseEventLogs({
              abi: FACTORY_ABI,
              logs: receipt.logs,
              eventName: 'MarketCreated',
            }) as unknown as { args: { market_id: bigint } }[]
            if (created) {
              const marketId = created.args.market_id.toString()
              updatePendingMeta(tx, { marketId })
              await api.updateMarketMetadata(marketId, meta)
              removePendingMeta(tx)
            }
          } catch (metaErr) {
            // Metadata is cosmetic — never fail the creation flow over it.
            // The pendingMeta entry stays behind and is replayed on the next
            // markets-page load, so the question still reaches the backend.
            console.warn('[createMarket] could not store market title (will retry on next load):', metaErr)
          }
        }

        setStep('confirmed')
        queryClient.invalidateQueries({ queryKey: ['markets'] })
        navigate('/markets')
      } catch (e) {
        // Log the full error object so the raw revert bytes are visible in DevTools.
        console.error('[createMarket] revert — full error object:', e)
        // Also log individual fields viem puts on the error for easier inspection.
        if (e && typeof e === 'object') {
          const err = e as Record<string, unknown>
          console.error('[createMarket] shortMessage:', err.shortMessage)
          console.error('[createMarket] message:', err.message)
          console.error('[createMarket] details:', err.details)
          console.error('[createMarket] data:', err.data)
          if (err.cause) console.error('[createMarket] cause:', err.cause)
        }
        setError(e instanceof Error ? e : new Error('Transaction failed'))
        setStep('error')
      }
    },
    [address, writeContractAsync, publicClient, queryClient, navigate],
  )

  const reset = useCallback(() => {
    setStep('idle')
    setTxHash(undefined)
    setError(undefined)
  }, [])

  return { step, create, reset, txHash, error }
}
