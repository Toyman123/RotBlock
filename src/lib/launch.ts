import { router } from 'expo-router';
import { Platform as RNPlatform } from 'react-native';
import type { AppId, FilterConfig } from './platforms';
import { PLATFORMS } from './platforms';

/** True when running as the web app (iPhone). */
export const IS_WEB = RNPlatform.OS === 'web';

/**
 * True when opened as a standalone home-screen web app. Safari add-ons (the
 * RotBlock blocker) don't run in this mode, and ordinary links open in an
 * in-app sheet where they don't run either — see openInSafari().
 */
export function isStandalone(): boolean {
  if (!IS_WEB || typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

const isIOS = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);

/**
 * Open a link in the real Safari app, where the RotBlock blocker runs.
 *
 * From the home-screen web app on iPhone, a plain link opens in an in-app
 * sheet that runs no Safari add-ons. The x-safari- prefix asks iOS to hand
 * the link to Safari itself. That's unconfirmed on every iOS version, so if
 * RotBlock is still on screen shortly after, fall back to a normal new window.
 *
 * Must be called inside the tap handler, or the browser treats it as a pop-up.
 */
export function openInSafari(url: string) {
  if (isStandalone() && isIOS()) {
    let left = false;
    const onHide = () => { if (document.visibilityState === 'hidden') left = true; };
    document.addEventListener('visibilitychange', onHide);
    window.location.href = `x-safari-${url}`;
    setTimeout(() => {
      document.removeEventListener('visibilitychange', onHide);
      if (!left && document.visibilityState === 'visible') window.open(url, '_blank', 'noopener');
    }, 1200);
    return;
  }
  window.open(url, '_blank', 'noopener');
}

/**
 * Open an app filtered.
 * - Native (Expo build): RotBlock's own filtered browser screen.
 * - Web app: the real site in Safari, where the RotBlock Safari add-on does
 *   the blocking. Your current filters ride along in the link (#rb=...) so the
 *   add-on always matches the switches in the app. The hash never reaches the
 *   site's server.
 */
export function launchApp(id: AppId, path: string | undefined, cfg: FilterConfig) {
  if (!IS_WEB) {
    router.push(path ? { pathname: '/browse/[id]', params: { id, path } } : `/browse/${id}`);
    return;
  }
  const base = PLATFORMS[id].url.replace(/\/$/, '');
  openInSafari(`${base}${path || '/'}#rb=${encodeURIComponent(JSON.stringify(cfg))}`);
}
