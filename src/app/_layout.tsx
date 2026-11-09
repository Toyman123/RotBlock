import {
  InterTight_400Regular, InterTight_500Medium, InterTight_600SemiBold, InterTight_700Bold, InterTight_800ExtraBold,
} from '@expo-google-fonts/inter-tight';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider } from '../lib/store';
import { colors } from '../lib/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ InterTight_400Regular, InterTight_500Medium, InterTight_600SemiBold, InterTight_700Bold, InterTight_800ExtraBold });

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="browse/[id]" options={{ animation: 'fade_from_bottom' }} />
          <Stack.Screen name="rules/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
