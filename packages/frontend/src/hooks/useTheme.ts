import { createContext, useContext, useEffect } from 'react'

interface ThemeContextValue {
  isDark: boolean
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue>({
  isDark: true,
  toggleTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function useThemeState() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
  }, [])

  return { isDark: true, toggleTheme: () => {} }
}
