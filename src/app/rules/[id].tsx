import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Press, Rise, Toggle } from '../../components/ui';
import { PLATFORMS, type AppId } from '../../lib/platforms';
import { useStore } from '../../lib/store';
import { MINUTES_PER_BLOCK, colors as c, fonts as f, radius } from '../../lib/theme';


export default function Rules() {
  const { id } = useLocalSearchParams<{ id: AppId }>();
  const p = PLATFORMS[id];
  const insets = useSafeAreaInsets();
  const { apps, setRule, setEnabled, stats } = useStore();
  if (!p) return null;
  const a = apps[p.id];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + 40 }}>
      <View style={s.wrap}>
        <View style={s.top}>
          <Press onPress={() => router.back()} label="Close" depth={0.9} hitSlop={6} style={s.close}>
            <Ionicons name="close" size={20} color={c.ink} />
          </Press>
        </View>

        <Rise style={s.head}>
          <View style={s.icon}>
            <Ionicons name={p.icon} size={30} color={c.ink} />
          </View>
          <Text style={s.title}>{p.name}</Text>
          <Text style={s.sub}>
            {stats.byApp[p.id]} blocked · ~{Math.round(stats.byApp[p.id] * MINUTES_PER_BLOCK)} min saved
          </Text>
        </Rise>

        <Rise delay={80} style={[s.card, s.row]}>
          <View style={{ flex: 1, paddingRight: 14 }}>
            <Text style={s.rowTitle}>{a.enabled ? 'Shield on' : 'Shield paused'}</Text>
            <Text style={s.rowSub}>{a.enabled ? 'Your filters are active.' : `${p.name} opens unfiltered.`}</Text>
          </View>
          <Toggle value={a.enabled} onChange={(v) => setEnabled(p.id, v)} />
        </Rise>

        <Rise delay={140}>
          <Text style={s.groupLabel}>What gets blocked</Text>
        </Rise>
        <Rise delay={180} style={[s.card, !a.enabled && { opacity: 0.4 }]}>
          <View pointerEvents={a.enabled ? 'auto' : 'none'}>
            {p.rules.map((r, i) => (
              <View key={r.key} style={[s.row, i > 0 && s.divider]}>
                <View style={{ flex: 1, paddingRight: 14 }}>
                  <Text style={s.rowTitle}>{r.label}</Text>
                  <Text style={s.rowSub}>{r.description}</Text>
                </View>
                <Toggle value={!!a.rules[r.key]} onChange={(v) => setRule(p.id, r.key, v)} />
              </View>
            ))}
          </View>
        </Rise>

        <Rise delay={260}>
          <Text style={s.note}>Changes apply instantly, even if {p.name} is already open.</Text>
          <Press onPress={() => router.back()} label="Done" haptic="medium" style={s.done}>
            <Text style={s.doneText}>Done</Text>
          </Press>
        </Rise>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 22, width: '100%', maxWidth: 560, alignSelf: 'center' },
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.fill, alignItems: 'center', justifyContent: 'center' },
  head: { marginTop: 8, marginBottom: 26 },
  icon: { width: 60, height: 60, borderRadius: 16, backgroundColor: c.fill, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { fontFamily: f.bold, fontSize: 40, letterSpacing: -1.6, color: c.ink },
  sub: { fontFamily: f.regular, fontSize: 15, color: c.sub, marginTop: 4 },
  card: { backgroundColor: c.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  divider: { borderTopWidth: 1, borderTopColor: c.line },
  rowTitle: { fontFamily: f.semibold, fontSize: 16, color: c.ink },
  rowSub: { fontFamily: f.regular, fontSize: 13, lineHeight: 18, color: c.sub, marginTop: 3 },
  groupLabel: { fontFamily: f.semibold, fontSize: 13, color: c.sub, marginTop: 28, marginBottom: 10 },
  note: { fontFamily: f.regular, fontSize: 12, color: c.faint, marginTop: 14 },
  done: { marginTop: 22, height: 56, borderRadius: radius.pill, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontFamily: f.bold, fontSize: 17, color: c.onAccent },
});
