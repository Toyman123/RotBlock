import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert, Animated, Easing, Modal, Platform as RNPlatform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CountUp, Press, Rise, Toggle, Wordmark, buzz, native } from '../components/ui';
import { PLATFORM_LIST, type AppId, type Platform } from '../lib/platforms';
import { useBlocker } from '../lib/blocker';
import { IS_WEB, isStandalone, launchApp } from '../lib/launch';
import { activeRuleCount, sum, useStore } from '../lib/store';

import { MINUTES_PER_BLOCK, colors as c, fonts as f, radius } from '../lib/theme';

/**
 * Home-screen web-app mode on iPhone: the blocker runs in Safari, not here, so
 * its status and counts can't be read. Show what RotBlock itself knows instead.
 */
const useLimited = () => {
  const blocker = useBlocker();
  return IS_WEB && !blocker.active && isStandalone();
};

type Tab = 'home' | 'stats' | 'settings';

/** What you might be opening each app for → where to land. */
const INTENTS: Record<AppId, { label: string; path: string }[]> = {
  youtube: [
    { label: 'Search for something', path: '/results?search_query=' },
    { label: 'Subscriptions', path: '/feed/subscriptions' },
    { label: 'Just browsing', path: '/' },
  ],
  instagram: [
    { label: 'Messages', path: '/direct/inbox/' },
    { label: 'Notifications', path: '/accounts/activity/' },
    { label: 'Just browsing', path: '/' },
  ],
  linkedin: [
    { label: 'Messages', path: '/messaging/' },
    { label: 'Jobs', path: '/jobs/' },
    { label: 'Just browsing', path: '/feed/' },
  ],
};

const mins = (blocks: number) => Math.round(blocks * MINUTES_PER_BLOCK);

/**
 * Block counts to show. On iPhone the Safari blocker does the blocking, so its
 * counts (read off the page) are the real ones; the native app counts its own.
 */
function useBlockStats() {
  const { stats } = useStore();
  const blocker = useBlocker();
  if (IS_WEB) {
    const b = blocker.stats;
    const zero = { youtube: 0, instagram: 0, linkedin: 0 };
    if (!b) return { total: 0, today: 0, byApp: zero, todayByApp: zero };
    const isToday = b.day === new Date().toISOString().slice(0, 10);
    return { total: b.total, today: isToday ? b.today : 0, byApp: b.byApp, todayByApp: isToday ? b.todayByApp : zero };
  }
  return { total: stats.total, today: stats.today, byApp: stats.byApp, todayByApp: stats.todayByApp };
}

export default function Main() {
  const insets = useSafeAreaInsets();
  const { prefs, configFor, recordOpen } = useStore();
  const [tab, setTab] = useState<Tab>('home');
  const [opening, setOpening] = useState<Platform | null>(null);

  const open = (p: Platform) => {
    if (prefs.askIntent) { setOpening(p); return; }
    recordOpen(p.id);
    launchApp(p.id, undefined, configFor(p.id));
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        key={tab}
        contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.wrap}>
          <Rise style={s.top}>
            <Wordmark />
          </Rise>
          {tab === 'home' && <HomeTab onOpen={open} />}
          {tab === 'stats' && <StatsTab />}
          {tab === 'settings' && <SettingsTab />}
        </View>
      </ScrollView>

      <TabBar tab={tab} onChange={setTab} bottom={insets.bottom} />
      <PauseSheet key={opening?.id ?? 'none'} platform={opening} onClose={() => setOpening(null)} />
    </View>
  );
}

/* ═════════════════════════════ HOME ═════════════════════════════ */

function HomeTab({ onOpen }: { onOpen: (p: Platform) => void }) {
  const { apps, prefs, setPref, stats } = useStore();
  const limited = useLimited();
  const bs = useBlockStats();
  const blocker = useBlocker();
  const live = PLATFORM_LIST.filter((p) => apps[p.id].enabled).length;

  return (
    <>
      {limited ? (
        <Rise delay={60} style={{ marginTop: 40 }}>
          <Text style={s.label}>Opened through RotBlock today</Text>
          <View style={s.bigRow}>
            <CountUp value={sum(stats.opensToday)} style={s.big} />
            <Text style={s.bigUnit}>{sum(stats.opensToday) === 1 ? 'time' : 'times'}</Text>
          </View>
          <Text style={s.heroSub}>Blocking happens in Safari. Time saved shows when RotBlock is opened in Safari.</Text>
        </Rise>
      ) : (
      <Rise delay={60} style={{ marginTop: 40 }}>
        <Text style={s.label}>Time saved today</Text>
        <View style={s.bigRow}>
          <CountUp value={mins(bs.today)} style={s.big} />
          <Text style={s.bigUnit}>min</Text>
        </View>
        <Text style={s.heroSub}>
          {bs.today} {bs.today === 1 ? 'thing' : 'things'} blocked today · {bs.total} all time
        </Text>
      </Rise>
      )}

      {IS_WEB && !blocker.active && !prefs.setupDone && (
        <Rise delay={120} style={s.setupCard}>
          <Text style={s.setupTitle}>Finish setting up</Text>
          <Text style={s.setupBody}>Blocking needs a one-time Safari step. Takes about 5 minutes.</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Press onPress={() => router.push('/setup')} label='Set up' haptic='medium' style={s.setupBtn}>
              <Text style={s.setupBtnText}>Set up</Text>
            </Press>
            <Press onPress={() => setPref('setupDone', true)} label='Hide' style={s.setupGhost}>
              <Text style={s.setupGhostText}>Hide</Text>
            </Press>
          </View>
        </Rise>
      )}

      <Rise delay={160} style={{ marginTop: 32 }}>
        <RotStrip />
      </Rise>

      <Rise delay={260} style={s.sectionHead}>
        <Text style={s.section}>Apps</Text>
        <View style={s.livePill}>
          <View style={[s.liveDot, { backgroundColor: live ? c.ink : c.faint }]} />
          <Text style={s.liveText}>{live} of 3 shielded</Text>
        </View>
      </Rise>

      {PLATFORM_LIST.map((p, i) => (
        <Rise key={p.id} delay={320 + i * 80}>
          <AppRow platform={p} onOpen={() => onOpen(p)} />
        </Rise>
      ))}
    </>
  );
}

/** Fake feed tiles that get shuttered, on a loop. */
const TILES = ['Short', 'Reel', 'For you', 'Suggested'];

function RotStrip() {
  const { width } = useWindowDimensions();
  const w = Math.min(width, 560) - 44;
  const tileW = (w - 3 * 8) / 4;
  const vals = useState(() => TILES.map(() => new Animated.Value(0)))[0];

  useEffect(() => {
    const ease = Easing.bezier(0.7, 0, 0.2, 1);
    const close = vals.map((v, i) =>
      Animated.sequence([Animated.delay(i * 380), Animated.timing(v, { toValue: 1, duration: 420, easing: ease, useNativeDriver: native })]),
    );
    const open = vals.map((v) => Animated.timing(v, { toValue: 0, duration: 500, easing: ease, useNativeDriver: native }));
    const loop = Animated.loop(Animated.sequence([Animated.delay(500), Animated.parallel(close), Animated.delay(1300), Animated.parallel(open)]));
    loop.start();
    return () => loop.stop();
  }, [vals]);

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {TILES.map((t, i) => (
        <View key={t} style={[s.tile, { width: tileW, height: tileW * 1.6 }]}>
          <View style={s.tileBadge}><Text style={s.tileBadgeText}>{t}</Text></View>
          <View style={[s.tileLine, { width: '70%' }]} />
          <View style={[s.tileLine, { width: '45%' }]} />
          <Animated.View style={[s.shutter, { transform: [{ scaleY: vals[i] }] }]} />
          <Animated.View style={[s.tileX, { opacity: vals[i], transform: [{ scale: vals[i].interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]}>
            <Ionicons name="close" size={22} color={c.onAccent} />
          </Animated.View>
        </View>
      ))}
    </View>
  );
}

function AppRow({ platform: p, onOpen }: { platform: Platform; onOpen: () => void }) {
  const { apps } = useStore();
  const bs = useBlockStats();
  const a = apps[p.id];
  const wipe = useState(() => new Animated.Value(0))[0];
  const blocking = a.enabled ? p.rules.filter((r) => a.rules[r.key]).map((r) => r.short) : [];

  const open = () => {
    buzz('medium');
    // Web: open during the tap itself (a delayed window.open gets blocked as a pop-up).
    if (IS_WEB) onOpen();
    Animated.timing(wipe, { toValue: 1, duration: 300, easing: Easing.bezier(0.7, 0, 0.2, 1), useNativeDriver: native }).start(() => {
      if (!IS_WEB) onOpen();
      Animated.timing(wipe, { toValue: 0, duration: 400, delay: 300, useNativeDriver: native }).start();
    });
  };

  return (
    <View style={{ marginBottom: 10 }}>
      <Press lift onPress={open} label={`Open ${p.name}`} haptic="none" style={s.row}>
        <View style={s.rowIcon}>
          <Ionicons name={p.icon} size={24} color={c.ink} />
        </View>
        <View style={{ flex: 1, paddingRight: 48 }}>
          <Text style={s.rowName}>{p.name}</Text>
          <Text style={s.rowSub} numberOfLines={1}>
            {a.enabled ? (
              <>Blocking <Text style={s.rowStrike}>{blocking.join(', ') || 'nothing'}</Text></>
            ) : (
              'Shield paused — opens unfiltered'
            )}
          </Text>
          <Text style={s.rowMeta}>
            {bs.byApp[p.id]} blocked · {activeRuleCount(a)} filters
          </Text>
        </View>
        <Animated.View pointerEvents="none" style={[s.rowWipe, { transform: [{ scaleX: wipe }] }]} />
      </Press>
      {/* sibling of the row, not nested, so it isn't a button inside a button */}
      <View style={s.rowGear}>
        <Press onPress={() => router.push(`/rules/${p.id}`)} label={`${p.name} filters`} depth={0.88} hitSlop={6} style={s.gear}>
          <Ionicons name="options-outline" size={18} color={c.ink} />
        </Press>
      </View>
    </View>
  );
}

/* ═════════════════════════════ STATS ═════════════════════════════ */

function StatsTab() {
  const stats = useBlockStats();
  const limited = useLimited();
  const [range, setRange] = useState<'today' | 'all'>('today');
  const byApp = range === 'today' ? stats.todayByApp : stats.byApp;
  const total = range === 'today' ? stats.today : stats.total;
  const max = Math.max(1, ...PLATFORM_LIST.map((p) => byApp[p.id]));

  return (
    <>
      <Rise delay={40} style={{ marginTop: 32 }}>
        <Text style={s.h1}>Stats</Text>
        <Segmented value={range} onChange={setRange} options={[{ value: 'today', label: 'Today' }, { value: 'all', label: 'All time' }]} />
        {limited && <Text style={s.note}>These counts come from the blocker in Safari. Open rotblock.vercel.app in Safari to see them.</Text>}
      </Rise>

      <Rise delay={120} key={range} style={{ marginTop: 30 }}>
        <Text style={s.label}>Time saved</Text>
        <View style={s.bigRow}>
          <CountUp value={mins(total)} style={s.big} />
          <Text style={s.bigUnit}>min</Text>
        </View>
        <Text style={s.heroSub}>{total} {total === 1 ? 'thing' : 'things'} blocked</Text>
      </Rise>

      <Rise delay={200} style={[s.card, { marginTop: 28 }]}>
        {PLATFORM_LIST.map((p, i) => (
          <View key={p.id} style={[s.statRow, i > 0 && s.divider]}>
            <View style={s.statHead}>
              <Ionicons name={p.icon} size={18} color={c.ink} />
              <Text style={s.statName}>{p.name}</Text>
              <Text style={s.statNum}>{byApp[p.id]}</Text>
              <Text style={s.statMin}>{mins(byApp[p.id])} min</Text>
            </View>
            <Bar ratio={byApp[p.id] / max} />
          </View>
        ))}
      </Rise>

      {total === 0 && (
        <Rise delay={260}>
          <Text style={s.note}>Nothing blocked {range === 'today' ? 'yet today' : 'yet'}. Open an app from Home and this fills up.</Text>
        </Rise>
      )}
      <Rise delay={300}>
        <Text style={s.note}>Time saved is an estimate: about {MINUTES_PER_BLOCK} minutes of scrolling per thing blocked.</Text>
      </Rise>
    </>
  );
}

function Bar({ ratio }: { ratio: number }) {
  const v = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(v, { toValue: ratio, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [ratio, v]);
  return (
    <View style={s.barTrack}>
      <Animated.View style={[s.barFill, { width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
    </View>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const [w, setW] = useState(0);
  const idx = options.findIndex((o) => o.value === value);
  const x = useState(() => new Animated.Value(idx))[0];
  useEffect(() => {
    Animated.spring(x, { toValue: idx, useNativeDriver: false, speed: 18, bounciness: 6 }).start();
  }, [idx, x]);
  const segW = w ? (w - 8) / options.length : 0;
  return (
    <View style={s.seg} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {segW > 0 && <Animated.View style={[s.segThumb, { width: segW, transform: [{ translateX: Animated.multiply(x, segW) }] }]} />}
      {options.map((o) => (
        <Pressable key={o.value} style={s.segItem} onPress={() => { buzz('select'); onChange(o.value); }} accessibilityRole="button">
          <Text style={[s.segText, o.value === value && { color: c.onAccent }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ═════════════════════════════ SETTINGS ═════════════════════════════ */

function SettingsTab() {
  const { apps, setEnabled, prefs, setPref, resetStats } = useStore();
  const blocker = useBlocker();

  const confirmReset = () => {
    const msg = 'This clears all your counts. Your filters stay as they are.';
    if (RNPlatform.OS === 'web') {
      if (window.confirm(`Reset stats?\n\n${msg}`)) resetStats();
      return;
    }
    Alert.alert('Reset stats?', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => { buzz('heavy'); resetStats(); } },
    ]);
  };

  return (
    <>
      <Rise delay={40} style={{ marginTop: 32 }}>
        <Text style={s.h1}>Settings</Text>
      </Rise>

      <Rise delay={100}>
        <Text style={s.groupLabel}>Shields</Text>
        <View style={s.card}>
          {PLATFORM_LIST.map((p, i) => (
            <View key={p.id} style={[s.setRow, i > 0 && s.divider]}>
              <Press onPress={() => router.push(`/rules/${p.id}`)} label={`${p.name} filters`} depth={0.98} haptic="light" outerStyle={{ flex: 1 }} style={s.setMain}>
                <Ionicons name={p.icon} size={20} color={c.ink} />
                <View style={{ flex: 1 }}>
                  <Text style={s.setTitle}>{p.name}</Text>
                  <Text style={s.setSub}>{apps[p.id].enabled ? `${activeRuleCount(apps[p.id])} filters on` : 'Paused'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.faint} />
              </Press>
              <Toggle value={apps[p.id].enabled} onChange={(v) => setEnabled(p.id, v)} />
            </View>
          ))}
        </View>
      </Rise>

      {IS_WEB && (
        <Rise delay={130}>
          <Text style={s.groupLabel}>Safari blocker</Text>
          <Press onPress={() => router.push('/setup')} label='Set up blocking' depth={0.98} style={[s.card, s.setRow]}>
            <Ionicons name={blocker.active ? 'shield-checkmark' : 'shield-outline'} size={20} color={blocker.active || isStandalone() ? c.ink : c.danger} />
            <View style={{ flex: 1 }}>
              <Text style={s.setTitle}>{blocker.active ? 'Blocker: active ✓' : isStandalone() ? 'Blocker runs in Safari' : 'Blocker: not detected'}</Text>
              <Text style={s.setSub}>{blocker.active ? `Version ${blocker.version} · tap for setup steps` : isStandalone() ? 'Its status can’t be read from the home-screen app. To check it, open rotblock.vercel.app in Safari.' : 'Tap to set it up (one time, about 5 minutes)'}</Text>
            </View>
            <Ionicons name='chevron-forward' size={18} color={c.faint} />
          </Press>
        </Rise>
      )}

      <Rise delay={160}>
        <Text style={s.groupLabel}>Opening apps</Text>
        <View style={s.card}>
          <View style={s.setRow}>
            <View style={{ flex: 1, paddingRight: 14 }}>
              <Text style={s.setTitle}>Ask what I&apos;m here for</Text>
              <Text style={s.setSub}>Pick Messages, Search and so on before an app opens.</Text>
            </View>
            <Toggle value={prefs.askIntent} onChange={(v) => setPref('askIntent', v)} />
          </View>
        </View>
      </Rise>

      <Rise delay={220}>
        <Text style={s.groupLabel}>Data</Text>
        <Press onPress={confirmReset} label="Reset stats" depth={0.98} style={[s.card, s.setRow]}>
          <Text style={[s.setTitle, { color: c.danger, flex: 1 }]}>Reset stats</Text>
          <Ionicons name="refresh" size={18} color={c.danger} />
        </Press>
      </Rise>

      <Rise delay={280}>
        <Text style={s.groupLabel}>How it works</Text>
        <Text style={s.about}>
          {IS_WEB
            ? 'RotBlock opens YouTube, Instagram and LinkedIn in Safari, where the RotBlock blocker hides Shorts, Reels and feeds. Delete the real apps so links can\x27t jump into them.'
            : "RotBlock opens the web versions of YouTube, Instagram and LinkedIn and filters them as they load. It can't change the real apps installed on your phone — so move those off your home screen and open them from here instead."}
        </Text>
      </Rise>
    </>
  );
}

/* ═════════════════════════════ PAUSE SHEET ═════════════════════════════ */

function PauseSheet({ platform: p, onClose }: { platform: Platform | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { configFor, recordOpen, recordBackout } = useStore();
  const slide = useState(() => new Animated.Value(0))[0];
  const [intent, setIntent] = useState(0);

  useEffect(() => {
    if (!p) return;
    slide.setValue(0);
    Animated.spring(slide, { toValue: 1, useNativeDriver: native, speed: 14, bounciness: 4 }).start();
  }, [p, slide]);

  if (!p) return null;
  const intents = INTENTS[p.id];

  const go = () => {
    const path = intents[intent].path;
    recordOpen(p.id);
    onClose();
    launchApp(p.id, path, configFor(p.id));
  };

  const backOut = () => {
    recordBackout(p.id);
    buzz('light');
    onClose();
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={backOut}>
      <Animated.View style={[s.backdrop, { opacity: slide }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={backOut} accessibilityLabel="Never mind" />
      </Animated.View>
      <Animated.View
        style={[s.sheet, { paddingBottom: insets.bottom + 20, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }) }] }]}
      >
        <View style={s.grabber} />
        <Text style={s.label}>Opening {p.name}</Text>
        <Text style={s.sheetTitle}>What are you here for?</Text>

        <View style={{ gap: 8, marginTop: 20 }}>
          {intents.map((it, i) => (
            <Press key={it.label} onPress={() => setIntent(i)} depth={0.97} style={[s.intent, intent === i && s.intentOn]}>
              <Text style={[s.intentText, intent === i && { color: c.ink }]}>{it.label}</Text>
              <View style={[s.radio, intent === i && s.radioOn]}>{intent === i && <View style={s.radioDot} />}</View>
            </Press>
          ))}
        </View>

        <Press onPress={go} label={`Open ${p.name}`} haptic="medium" style={s.goBtn}>
          <Text style={s.goText}>Open {p.name}</Text>
          <Ionicons name="arrow-forward" size={18} color={c.onAccent} />
        </Press>

        <Pressable onPress={backOut} style={s.nevermind} accessibilityRole="button">
          <Text style={s.nevermindText}>Never mind</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

/* ═════════════════════════════ TAB BAR ═════════════════════════════ */

const TABS: { id: Tab; icon: keyof typeof Ionicons.glyphMap; iconOn: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { id: 'home', icon: 'home-outline', iconOn: 'home', label: 'Home' },
  { id: 'stats', icon: 'stats-chart-outline', iconOn: 'stats-chart', label: 'Stats' },
  { id: 'settings', icon: 'settings-outline', iconOn: 'settings', label: 'Settings' },
];

function TabBar({ tab, onChange, bottom }: { tab: Tab; onChange: (t: Tab) => void; bottom: number }) {
  const [w, setW] = useState(0);
  const idx = TABS.findIndex((t) => t.id === tab);
  const x = useState(() => new Animated.Value(idx))[0];
  useEffect(() => {
    Animated.spring(x, { toValue: idx, useNativeDriver: false, speed: 16, bounciness: 8 }).start();
  }, [idx, x]);
  const tabW = w / TABS.length;

  return (
    <View style={[s.tabs, { paddingBottom: Math.max(bottom, 10) }]}>
      <View style={s.tabsInner} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {w > 0 && (
          <Animated.View style={[s.tabIndicator, { left: Animated.add(Animated.multiply(x, tabW), tabW / 2 - 12) }]} />
        )}
        {TABS.map((t) => {
          const on = t.id === tab;
          return (
            <Press key={t.id} onPress={() => onChange(t.id)} label={t.label} depth={0.9} outerStyle={{ flex: 1 }} style={s.tab}>
              <Ionicons name={on ? t.iconOn : t.icon} size={21} color={on ? c.ink : c.faint} />
              <Text style={[s.tabText, { color: on ? c.ink : c.faint }]}>{t.label}</Text>
            </Press>
          );
        })}
      </View>
    </View>
  );
}

/* ═════════════════════════════ STYLES ═════════════════════════════ */

const fill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 22, width: '100%', maxWidth: 560, alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 36 },

  h1: { fontFamily: f.bold, fontSize: 34, letterSpacing: -1.2, color: c.ink, marginBottom: 16 },
  label: { fontFamily: f.medium, fontSize: 14, color: c.sub },
  bigRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 2 },
  big: { fontFamily: f.black, fontSize: 112, lineHeight: 116, letterSpacing: -6, color: c.ink },
  bigUnit: { fontFamily: f.bold, fontSize: 28, color: c.ink, marginBottom: 20, letterSpacing: -1 },
  heroSub: { fontFamily: f.regular, fontSize: 15, color: c.sub, marginTop: 2 },

  tile: { borderRadius: 12, backgroundColor: c.fill, overflow: 'hidden', padding: 8, justifyContent: 'flex-end', gap: 5 },
  tileBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: c.card, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tileBadgeText: { fontFamily: f.semibold, fontSize: 10, color: c.sub },
  tileLine: { height: 6, borderRadius: 3, backgroundColor: c.track },
  shutter: { ...fill, backgroundColor: c.accent, transformOrigin: 'top' },
  tileX: { ...fill, alignItems: 'center', justifyContent: 'center' },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 44, marginBottom: 14 },
  section: { fontFamily: f.bold, fontSize: 24, letterSpacing: -0.8, color: c.ink },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontFamily: f.medium, fontSize: 13, color: c.sub },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.md, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, overflow: 'hidden' },
  rowIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: c.fill, alignItems: 'center', justifyContent: 'center' },
  rowName: { fontFamily: f.bold, fontSize: 18, letterSpacing: -0.4, color: c.ink },
  rowSub: { fontFamily: f.regular, fontSize: 13, color: c.sub, marginTop: 2 },
  rowStrike: { textDecorationLine: 'line-through', color: c.ink, fontFamily: f.medium },
  rowMeta: { fontFamily: f.regular, fontSize: 12, color: c.faint, marginTop: 4 },
  rowWipe: { ...fill, backgroundColor: c.accent, transformOrigin: 'left' },
  rowGear: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  gear: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.fill, alignItems: 'center', justifyContent: 'center' },

  card: { backgroundColor: c.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, paddingHorizontal: 16 },
  divider: { borderTopWidth: 1, borderTopColor: c.line },
  setupCard: { marginTop: 28, padding: 18, borderRadius: radius.md, backgroundColor: c.ink },
  setupTitle: { fontFamily: f.bold, fontSize: 18, color: c.onAccent, letterSpacing: -0.4 },
  setupBody: { fontFamily: f.regular, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  setupBtn: { height: 42, paddingHorizontal: 20, borderRadius: radius.pill, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' },
  setupBtnText: { fontFamily: f.bold, fontSize: 15, color: c.ink },
  setupGhost: { height: 42, paddingHorizontal: 14, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  setupGhostText: { fontFamily: f.medium, fontSize: 14, color: 'rgba(255,255,255,0.75)' },
  note: { fontFamily: f.regular, fontSize: 12, lineHeight: 17, color: c.faint, marginTop: 16 },

  statRow: { paddingVertical: 16, gap: 10 },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statName: { flex: 1, fontFamily: f.semibold, fontSize: 16, color: c.ink },
  statNum: { fontFamily: f.bold, fontSize: 16, color: c.ink, fontVariant: ['tabular-nums'] },
  statMin: { fontFamily: f.regular, fontSize: 13, color: c.faint, minWidth: 56, textAlign: 'right', fontVariant: ['tabular-nums'] },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: c.fill, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: c.accent },

  seg: { flexDirection: 'row', backgroundColor: c.fill, borderRadius: radius.pill, padding: 4, alignSelf: 'flex-start', minWidth: 220 },
  segThumb: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: radius.pill, backgroundColor: c.accent },
  segItem: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  segText: { fontFamily: f.semibold, fontSize: 14, color: c.sub },

  groupLabel: { fontFamily: f.semibold, fontSize: 13, color: c.sub, marginTop: 28, marginBottom: 10 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10 },
  setMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  setTitle: { fontFamily: f.semibold, fontSize: 16, color: c.ink },
  setSub: { fontFamily: f.regular, fontSize: 13, color: c.sub, marginTop: 2 },
  about: { fontFamily: f.regular, fontSize: 14, lineHeight: 21, color: c.sub },

  backdrop: { ...fill, backgroundColor: 'rgba(13,13,16,0.35)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: 22, paddingTop: 10, maxWidth: 560, width: '100%', alignSelf: 'center' },
  grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: c.line, alignSelf: 'center', marginBottom: 18 },
  sheetTitle: { fontFamily: f.bold, fontSize: 30, lineHeight: 34, letterSpacing: -1.2, color: c.ink, marginTop: 4 },
  intent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 54, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1.5, borderColor: c.line },
  intentOn: { borderColor: c.ink },
  intentText: { fontFamily: f.medium, fontSize: 16, color: c.sub },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: c.faint, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: c.ink },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.ink },
  goBtn: { marginTop: 22, height: 58, borderRadius: radius.pill, backgroundColor: c.accent, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  goText: { fontFamily: f.bold, fontSize: 17, color: c.onAccent },
  nevermind: { alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 20, marginTop: 4 },
  nevermindText: { fontFamily: f.medium, fontSize: 15, color: c.sub },

  tabs: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 8, backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.line },
  tabsInner: { flexDirection: 'row', width: '100%', maxWidth: 560, alignSelf: 'center' },
  tab: { alignItems: 'center', gap: 3, paddingVertical: 6 },
  tabText: { fontFamily: f.medium, fontSize: 11 },
  tabIndicator: { position: 'absolute', top: -9, width: 24, height: 3, borderRadius: 2, backgroundColor: c.ink },
});
