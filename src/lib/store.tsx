import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PLATFORM_LIST, PLATFORMS, defaultRules, type AppId, type FilterConfig } from './platforms';

type AppSettings = { enabled: boolean; rules: Record<string, boolean> };

type State = {
  apps: Record<AppId, AppSettings>;
  stats: { total: number; today: number; day: string; byApp: Record<AppId, number>; todayByApp: Record<AppId, number>;
    /** Opens through RotBlock, and times you backed out on the pause screen. */
    opens: Record<AppId, number>; opensToday: Record<AppId, number>;
    backouts: Record<AppId, number>; backoutsToday: Record<AppId, number> };
  /** askIntent: show the "What are you here for?" sheet before opening an app. */
  prefs: { askIntent: boolean; setupDone: boolean; safariNoticeDismissed: boolean };
};

const KEY = 'rotblock:v1';
const todayKey = () => new Date().toISOString().slice(0, 10);

const zero = (): Record<AppId, number> => ({ youtube: 0, instagram: 0, linkedin: 0 });

const emptyStats = (): State["stats"] => ({
  total: 0, today: 0, day: todayKey(), byApp: zero(), todayByApp: zero(),
  opens: zero(), opensToday: zero(), backouts: zero(), backoutsToday: zero(),
});

/** Roll today counters over at midnight. */
const freshDay = (st: State["stats"]): State["stats"] =>
  st.day === todayKey() ? st : { ...st, day: todayKey(), today: 0, todayByApp: zero(), opensToday: zero(), backoutsToday: zero() };

const initial = (): State => ({
  apps: Object.fromEntries(
    PLATFORM_LIST.map((p) => [p.id, { enabled: true, rules: defaultRules(p) }]),
  ) as State['apps'],
  stats: emptyStats(),
  prefs: { askIntent: false, setupDone: false, safariNoticeDismissed: false },
});

type Ctx = State & {
  ready: boolean;
  setRule: (id: AppId, key: string, value: boolean) => void;
  setEnabled: (id: AppId, value: boolean) => void;
  recordBlock: (id: AppId) => void;
  recordOpen: (id: AppId) => void;
  recordBackout: (id: AppId) => void;
  setPref: <K extends keyof State["prefs"]>(key: K, value: State["prefs"][K]) => void;
  resetStats: () => void;
  configFor: (id: AppId) => FilterConfig;
};

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<State>;
        setState((s) => {
          const apps = { ...s.apps };
          for (const p of PLATFORM_LIST) {
            const a = saved.apps?.[p.id];
            if (a) apps[p.id] = { enabled: a.enabled ?? true, rules: { ...defaultRules(p), ...a.rules } };
          }
          const ss = saved.stats;
          const stats = freshDay({
            ...s.stats, ...ss,
            byApp: { ...zero(), ...ss?.byApp }, todayByApp: { ...zero(), ...ss?.todayByApp },
            opens: { ...zero(), ...ss?.opens }, opensToday: { ...zero(), ...ss?.opensToday },
            backouts: { ...zero(), ...ss?.backouts }, backoutsToday: { ...zero(), ...ss?.backoutsToday },
          });
          return { apps, stats, prefs: { ...s.prefs, ...saved.prefs } };
        });
      })
      .catch(() => {})
      .finally(() => { loaded.current = true; setReady(true); });
  }, []);

  useEffect(() => {
    if (loaded.current) AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, [state]);

  const setRule = useCallback((id: AppId, key: string, value: boolean) => {
    setState((s) => ({ ...s, apps: { ...s.apps, [id]: { ...s.apps[id], rules: { ...s.apps[id].rules, [key]: value } } } }));
  }, []);

  const setEnabled = useCallback((id: AppId, value: boolean) => {
    setState((s) => ({ ...s, apps: { ...s.apps, [id]: { ...s.apps[id], enabled: value } } }));
  }, []);

  const recordBlock = useCallback((id: AppId) => {
    setState((s) => {
      const st = freshDay(s.stats);
      return { ...s, stats: { ...st, total: st.total + 1, today: st.today + 1, byApp: { ...st.byApp, [id]: st.byApp[id] + 1 }, todayByApp: { ...st.todayByApp, [id]: st.todayByApp[id] + 1 } } };
    });
  }, []);

  const recordOpen = useCallback((id: AppId) => {
    setState((s) => {
      const st = freshDay(s.stats);
      return { ...s, stats: { ...st, opens: { ...st.opens, [id]: st.opens[id] + 1 }, opensToday: { ...st.opensToday, [id]: st.opensToday[id] + 1 } } };
    });
  }, []);

  const recordBackout = useCallback((id: AppId) => {
    setState((s) => {
      const st = freshDay(s.stats);
      return { ...s, stats: { ...st, backouts: { ...st.backouts, [id]: st.backouts[id] + 1 }, backoutsToday: { ...st.backoutsToday, [id]: st.backoutsToday[id] + 1 } } };
    });
  }, []);

  const setPref = useCallback(<K extends keyof State["prefs"]>(key: K, value: State["prefs"][K]) => {
    setState((s) => ({ ...s, prefs: { ...s.prefs, [key]: value } }));
  }, []);

  const resetStats = useCallback(() => {
    setState((s) => ({ ...s, stats: emptyStats() }));
  }, []);

  const configFor = useCallback(
    (id: AppId): FilterConfig => ({ enabled: state.apps[id].enabled, ...PLATFORMS[id].build(state.apps[id].rules) }),
    [state.apps],
  );

  const value = useMemo(
    () => ({ ...state, ready, setRule, setEnabled, recordBlock, recordOpen, recordBackout, setPref, resetStats, configFor }),
    [state, ready, setRule, setEnabled, recordBlock, recordOpen, recordBackout, setPref, resetStats, configFor],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

export const sum = (r: Record<AppId, number>) => r.youtube + r.instagram + r.linkedin;

export const activeRuleCount = (a: AppSettings) => Object.values(a.rules).filter(Boolean).length;
