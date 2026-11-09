import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import { Animated, BackHandler, Platform as RNPlatform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RNWebView, { type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';
import { Press } from '../../components/ui';
import { buildInjection, buildUpdate } from '../../lib/engine';
import { PLATFORMS, type AppId } from '../../lib/platforms';
import { activeRuleCount, useStore } from '../../lib/store';
import { colors as c, fonts as f, radius } from '../../lib/theme';

type WebViewHandle = { goBack: () => void; injectJavaScript: (js: string) => void; reload: () => void };
// The package types it as a plain FunctionComponent, but it forwards a ref with these methods.
const WebView = RNWebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewHandle> }>;

// Present as a normal mobile browser. The default WebView UA contains "wv",
// which some sites (notably Google sign-in) refuse.
const UA = RNPlatform.select({
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
});


export default function Browse() {
  const { id, path } = useLocalSearchParams<{ id: AppId; path?: string }>();
  const p = PLATFORMS[id];
  const insets = useSafeAreaInsets();
  const { apps, configFor, recordBlock } = useStore();
  const web = useRef<WebViewHandle>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));
  const [loading, setLoading] = useState(true);
  const toast = useState(() => new Animated.Value(0))[0];
  const [toastText, setToastText] = useState('');

  const cfg = p ? configFor(p.id) : null;
  // The first injection is frozen; later rule changes are pushed live.
  const [initialScript] = useState(() => (cfg ? buildInjection(cfg) : ''));

  const cfgKey = cfg ? JSON.stringify(cfg) : '';
  useEffect(() => {
    if (cfg) web.current?.injectJavaScript(buildUpdate(cfg));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfgKey]);

  useEffect(() => {
    if (RNPlatform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) { web.current?.goBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  if (!p || !cfg) return null;
  const a = apps[p.id];

  const flash = (text: string) => {
    setToastText(text);
    toast.setValue(0);
    Animated.sequence([
      Animated.spring(toast, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }),
      Animated.delay(1400),
      Animated.timing(toast, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const m = JSON.parse(e.nativeEvent.data);
      if (m.type === 'blocked') {
        recordBlock(p.id);
        flash(`${m.rule} blocked`);
      }
    } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      {/* Toolbar */}
      <View style={s.bar}>
        <Press onPress={() => (canGoBack ? web.current?.goBack() : router.back())} label="Back" depth={0.9} hitSlop={6} style={s.btn}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Press>
        <View style={s.title}>
          <Ionicons name={p.icon} size={18} color={c.ink} />
          <Text style={s.titleText}>{p.name}</Text>
        </View>
        <Press onPress={() => router.push(`/rules/${p.id}`)} label="Filters" depth={0.92} style={[s.shield, !a.enabled && s.shieldOff]}>
          <Ionicons name={a.enabled ? 'shield-checkmark' : 'shield-outline'} size={15} color={a.enabled ? c.onAccent : c.danger} />
          <Text style={[s.shieldText, !a.enabled && { color: c.danger }]}>{a.enabled ? `${activeRuleCount(a)} on` : 'Off'}</Text>
        </Press>
        <Press onPress={() => router.back()} label="Back to RotBlock" depth={0.9} hitSlop={6} style={s.btn}>
          <Ionicons name="close" size={20} color={c.ink} />
        </Press>
      </View>

      <Animated.View style={[s.progress, { opacity: loading ? 1 : 0, transform: [{ scaleX: progress }] }]} />

      {RNPlatform.OS === 'web' ? (
        <View style={s.webNote}>
          <Ionicons name="phone-portrait-outline" size={32} color={c.ink} />
          <Text style={s.webNoteTitle}>Open RotBlock on your phone</Text>
          <Text style={s.webNoteSub}>The filtered {p.name} browser runs inside the mobile app (Expo Go or a build). This web preview is for the UI only.</Text>
        </View>
      ) : (
        <WebView
          ref={web}
          source={{ uri: path ? p.url.replace(/\/$/, '') + path : p.url }}
          style={{ flex: 1, backgroundColor: c.bg }}
          userAgent={UA}
          injectedJavaScriptBeforeContentLoaded={initialScript}
          injectedJavaScript={initialScript}
          onMessage={onMessage}
          onNavigationStateChange={(n) => setCanGoBack(n.canGoBack)}
          onLoadStart={() => { setLoading(true); progress.setValue(0.1); }}
          onLoadProgress={({ nativeEvent }) => Animated.timing(progress, { toValue: nativeEvent.progress, duration: 150, useNativeDriver: true }).start()}
          onLoadEnd={() => setLoading(false)}
          // Keep links inside RotBlock — never hand off to the real (unfiltered) app.
          onShouldStartLoadWithRequest={(req) => /^(https?|about|blob|data):/.test(req.url)}
          setSupportMultipleWindows={false}
          allowsBackForwardNavigationGestures
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          domStorageEnabled
          pullToRefreshEnabled
          decelerationRate="normal"
        />
      )}

      {/* Block toast */}
      <Animated.View
        pointerEvents="none"
        style={[
          s.toast,
          { bottom: insets.bottom + 24, opacity: toast, transform: [{ translateY: toast.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }, { scale: toast.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] },
        ]}
      >
        <Ionicons name="close-circle" size={16} color={c.onAccent} />
        <Text style={s.toastText}>{toastText}</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.line },
  btn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.fill, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  titleText: { color: c.ink, fontFamily: f.bold, fontSize: 17, letterSpacing: -0.4 },
  shield: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: c.accent },
  shieldOff: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.danger },
  shieldText: { color: c.onAccent, fontFamily: f.semibold, fontSize: 14 },
  progress: { height: 2, backgroundColor: c.ink, transformOrigin: 'left' },
  webNote: { flex: 1, justifyContent: 'center', padding: 28, gap: 12, maxWidth: 520, width: '100%', alignSelf: 'center' },
  webNoteTitle: { color: c.ink, fontFamily: f.bold, fontSize: 28, lineHeight: 32, letterSpacing: -1 },
  webNoteSub: { color: c.sub, fontFamily: f.regular, fontSize: 15, lineHeight: 22 },
  toast: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.accent, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.pill },
  toastText: { color: c.onAccent, fontFamily: f.semibold, fontSize: 14 },
});
