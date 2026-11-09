import { useEffect, useState } from 'react';
import { IS_WEB } from './launch';
import type { AppId } from './platforms';

export type BlockerStats = {
  day: string;
  total: number;
  today: number;
  byApp: Record<AppId, number>;
  todayByApp: Record<AppId, number>;
};

export type BlockerInfo = { active: boolean; version: string | null; stats: BlockerStats | null };

/**
 * Reads what the RotBlock Safari blocker leaves on this page (see
 * scripts/build-userscript.mts): whether it's installed, and its block counts.
 */
function read(): BlockerInfo {
  if (!IS_WEB || typeof document === 'undefined') return { active: false, version: null, stats: null };
  const root = document.documentElement;
  const version = root.getAttribute('data-rotblock-blocker');
  let stats: BlockerStats | null = null;
  try {
    const raw = root.getAttribute('data-rotblock-stats');
    if (raw) stats = JSON.parse(raw) as BlockerStats;
  } catch {}
  return { active: !!version, version, stats };
}

export function useBlocker(): BlockerInfo {
  const [info, setInfo] = useState<BlockerInfo>(read);
  useEffect(() => {
    if (!IS_WEB) return;
    const update = () => setInfo((prev) => {
      const next = read();
      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
    });
    const t = setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', update); };
  }, []);
  return info;
}
