import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@rainbow-me/rainbowkit/styles.css'

import { wagmiConfig } from '@/config/wagmi'
import { connectSocket } from '@/lib/socket'
import { ThemeProvider } from '@/components/ThemeProvider'
import { useTheme } from '@/hooks/useTheme'
import App from './App'
import '@/styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

function Root() {
  useEffect(() => {
    connectSocket()
  }, [])
  return <App />
}

function RainbowKitWithTheme({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme()
  const rkTheme = isDark
    ? darkTheme({ accentColor: '#C41230', accentColorForeground: '#ffffff', borderRadius: 'small', fontStack: 'system' })
    : lightTheme({ accentColor: '#C41230', accentColorForeground: '#ffffff', borderRadius: 'small', fontStack: 'system' })
  return <RainbowKitProvider theme={rkTheme}>{children}</RainbowKitProvider>
}

const router = createBrowserRouter([
  {
    path: '*',
    element: <Root />,
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RainbowKitWithTheme>
            <RouterProvider router={router} />
          </RainbowKitWithTheme>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)
