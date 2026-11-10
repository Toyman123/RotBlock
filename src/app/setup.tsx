import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Press, Rise } from '../components/ui';
import { useBlocker } from '../lib/blocker';
import { isStandalone, openInSafari } from '../lib/launch';
import { useStore } from '../lib/store';
import { colors as c, fonts as f, radius } from '../lib/theme';

const APP_STORE = 'https://apps.apple.com/app/userscripts/id1463298887';

const origin = () => (typeof window !== 'undefined' ? window.location.origin : '');
/** Served as a download (see public/vercel.json) so Safari saves it instead of showing code. */
const downloadUrl = () => `${origin()}/download/rotblock.user.js`;
/** Plain copy, for the Safari-menu install method. */
const viewUrl = () => `${origin()}/rotblock.user.js`;


type Step = { title: string; lines: string[]; action?: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void } };

const STEPS: Step[] = [
  {
    title: 'Get Userscripts (free)',
    lines: ['It’s the app that lets RotBlock block things in Safari. Open it once after installing.'],
    action: { label: 'Open App Store', icon: 'download-outline', onPress: () => Linking.openURL(APP_STORE) },
  },
  {
    title: 'Switch it on in Safari',
    lines: [
      'Open Settings → Apps → Safari → Extensions → Userscripts.',
      'Turn it on, and set All Websites to Allow.',
    ],
  },
  {
    title: 'Install the blocker',
    lines: [
      'Tap below. Safari shows a page of code — that’s normal.',
      'Tap the puzzle piece (bottom-left) → Userscripts → Install.',
      'Or type rotblock.vercel.app/install in Safari.',
    ],
    action: { label: 'Open blocker', icon: 'arrow-forward', onPress: () => openInSafari(viewUrl()) },
  },
  {
    title: 'Delete the real apps',
    lines: ['Remove YouTube, Instagram and LinkedIn so links can’t jump into them. Open them from RotBlock instead.'],
  },
];

export default function Setup() {
  const insets = useSafeAreaInsets();
  const { setPref } = useStore();
  const [showAlt, setShowAlt] = useState(false);
  const blocker = useBlocker();

  const done = () => {
    setPref('setupDone', true);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + 40 }}>
      <View style={s.wrap}>
        <View style={s.top}>
          <Press onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} label="Close" depth={0.9} hitSlop={6} style={s.close}>
            <Ionicons name="close" size={20} color={c.ink} />
          </Press>
        </View>

        <Rise>
          <Text style={s.title}>Set up blocking</Text>
          <Text style={s.sub}>Four quick steps, one time. Do them in order.</Text>
        </Rise>

        <View style={[s.status, blocker.active && s.statusOn]}>
          <Ionicons name={blocker.active ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={blocker.active ? c.onAccent : c.sub} />
          <Text style={[s.statusText, blocker.active && { color: c.onAccent }]}>
            {blocker.active ? `Blocker active (v${blocker.version}) — you’re set` : isStandalone() ? 'To check the blocker, open rotblock.vercel.app in Safari' : 'Blocker not detected yet'}
          </Text>
        </View>

        {STEPS.map((step, i) => (
          <Rise key={step.title} delay={80 + i * 70} style={[s.step, i > 0 && s.divider]}>
            <View style={s.num}><Text style={s.numText}>{i + 1}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.stepTitle}>{step.title}</Text>
              {step.lines.map((line) => (
                <Text key={line} style={s.stepBody}>{line}</Text>
              ))}
              {step.action && (
                <Press onPress={step.action.onPress} label={step.action.label} haptic="medium" style={s.btn}>
                  <Ionicons name={step.action.icon} size={17} color={c.onAccent} />
                  <Text style={s.btnText}>{step.action.label}</Text>
                </Press>
              )}
            </View>
          </Rise>
        ))}

        <Rise delay={480}>
          <Press onPress={done} label="I'm done" haptic="medium" style={s.doneBtn}>
            <Text style={s.doneText}>I&apos;m done</Text>
          </Press>
          <Text style={s.note}>Check it worked: open YouTube from RotBlock. If the home feed is replaced by “What did you come here for?”, you’re set.</Text>
          <Text style={s.note}>Keep getting signed out? Make sure Safari isn’t on a Private tab (dark address bar), and sign in once in Safari itself — not in a pop-up with a “Done” button. Safari remembers it after that.</Text>

          <Press onPress={() => setShowAlt((v) => !v)} label="No Install button?" depth={0.98} style={s.altToggle}>
            <Text style={s.altToggleText}>No Install button?</Text>
            <Ionicons name={showAlt ? 'chevron-up' : 'chevron-down'} size={16} color={c.sub} />
          </Press>
          {showAlt && (
            <View style={s.alt}>
              <Text style={s.stepBody}>1. In the Userscripts app, tap “Set Userscripts Directory” and pick iCloud Drive → Downloads.</Text>
              <Text style={s.stepBody}>2. Tap the button below, then tap Download.</Text>
              <Press onPress={() => openInSafari(downloadUrl())} label="Download blocker" style={[s.btn, s.btnGhost]}>
                <Text style={[s.btnText, { color: c.ink }]}>Download blocker</Text>
              </Press>
            </View>
          )}
        </Rise>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 22, width: '100%', maxWidth: 560, alignSelf: 'center' },
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.fill, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: f.bold, fontSize: 36, letterSpacing: -1.4, color: c.ink, marginTop: 8 },
  sub: { fontFamily: f.regular, fontSize: 15, lineHeight: 22, color: c.sub, marginTop: 6, marginBottom: 14 },
  step: { flexDirection: 'row', gap: 14, paddingVertical: 20 },
  divider: { borderTopWidth: 1, borderTopColor: c.line },
  num: { width: 30, height: 30, borderRadius: 15, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
  numText: { fontFamily: f.bold, fontSize: 14, color: c.onAccent },
  stepTitle: { fontFamily: f.semibold, fontSize: 18, color: c.ink, letterSpacing: -0.3, marginBottom: 4 },
  stepBody: { fontFamily: f.regular, fontSize: 15, lineHeight: 22, color: c.sub },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginTop: 14, height: 48, paddingHorizontal: 20, borderRadius: radius.pill, backgroundColor: c.accent },
  btnGhost: { backgroundColor: c.fill },
  btnText: { fontFamily: f.semibold, fontSize: 16, color: c.onAccent },
  doneBtn: { marginTop: 12, height: 56, borderRadius: radius.pill, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontFamily: f.bold, fontSize: 17, color: c.onAccent },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: c.fill, marginTop: 4, marginBottom: 6 },
  statusOn: { backgroundColor: c.ink },
  statusText: { fontFamily: f.semibold, fontSize: 15, color: c.sub, flex: 1 },
  note: { fontFamily: f.regular, fontSize: 13, lineHeight: 19, color: c.faint, marginTop: 14 },
  altToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 22, paddingVertical: 8 },
  altToggleText: { fontFamily: f.semibold, fontSize: 14, color: c.sub },
  alt: { marginTop: 4, padding: 16, borderRadius: radius.md, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, gap: 4 },
});
