/**
 * The theme switch. `data-theme` on `<html>` is what the token layer
 * (`packages/ui/src/styles/tokens.css`) reads; warm dark is the default and the value the server
 * renders, so nothing is themed by the client on a first paint.
 */
export type Theme = 'dark' | 'light';

export const DEFAULT_THEME: Theme = 'dark';

/** The localStorage key the inline boot script and the toggle share. */
export const THEME_STORAGE_KEY = 'tas-theme';

export function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light';
}

/**
 * Runs in `<head>` before the first paint, so a visitor who chose light never sees a dark flash.
 * Inlined as a string because it must execute before React hydrates; `try/catch` because a private
 * window or blocked site data makes `localStorage` throw on access.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;
