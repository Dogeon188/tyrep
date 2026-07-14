import { useEffect, useState } from 'react'

type Theme = 'system' | 'light' | 'dark'

const ICONS: Record<Theme, React.ReactNode> = {
  system: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 18v3" />
    </svg>
  ),
  dark: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  ),
  light: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ),
}

function applyTheme(theme: Theme) {
  if (theme === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('theme') as Theme | null) ?? 'system',
  )

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <span className="theme-switcher">
      {(['system', 'dark', 'light'] as const).map((t) => (
        <button
          key={t}
          type="button"
          aria-label={t}
          aria-pressed={theme === t}
          onClick={() => setTheme(t)}
        >
          {ICONS[t]}
        </button>
      ))}
    </span>
  )
}