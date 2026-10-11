import { useTheme } from '@/shared/theme';

/**
 * The student pages use the site-wide theme (one toggle for the whole website).
 * Kept as a hook with the same shape the pages already use.
 */
export function useThemeStore(): { isDark: boolean; toggle: () => void } {
  const { isDark, toggleTheme } = useTheme();
  return { isDark, toggle: toggleTheme };
}
