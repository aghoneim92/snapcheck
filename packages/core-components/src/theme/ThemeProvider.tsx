import type { ThemeName } from '@snapcheck/tokens';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'snapcheck-theme';

function readStoredTheme(): ThemeName | null {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    // Private windows and blocked site data throw on access; a missing
    // preference is not an error worth surfacing.
    return null;
  }
}

export interface ThemeProviderProps {
  children: ReactNode;
  /** Theme to start from when nothing is stored. Defaults to `light`. */
  defaultTheme?: ThemeName;
  /**
   * Element that carries `data-theme`. Defaults to `<html>`, which is what the
   * token stylesheet targets. Storybook passes a per-story element instead.
   */
  target?: HTMLElement | null;
  /** Skip reading and writing `localStorage`. Useful in stories and tests. */
  persist?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = 'light',
  target,
  persist = true,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeName>(
    () => (persist ? readStoredTheme() : null) ?? defaultTheme,
  );

  // When persistence is off, `defaultTheme` is the source of truth — that is
  // how the Storybook toolbar drives the theme. Reset during render rather than
  // in an effect, so the new theme paints in the same commit.
  const [lastDefaultTheme, setLastDefaultTheme] = useState(defaultTheme);
  if (!persist && defaultTheme !== lastDefaultTheme) {
    setLastDefaultTheme(defaultTheme);
    setThemeState(defaultTheme);
  }

  useEffect(() => {
    const element = target ?? globalThis.document?.documentElement;
    element?.setAttribute('data-theme', theme);
  }, [theme, target]);

  const setTheme = useCallback(
    (next: ThemeName) => {
      setThemeState(next);
      if (!persist) return;
      try {
        globalThis.localStorage?.setItem(STORAGE_KEY, next);
      } catch {
        // Non-fatal: the theme still applies for this session.
      }
    },
    [persist],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    }),
    [theme, setTheme],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const context = use(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside a <ThemeProvider>');
  return context;
}
