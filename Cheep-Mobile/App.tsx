/**
 * 🚀 Cheep Mobile App
 * Main entry point
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { I18nextProvider } from 'react-i18next';
import * as Localization from 'expo-localization';
import i18n, { SUPPORTED_LANGUAGES } from './src/i18n';
import { LocaleProvider } from './src/context/LocaleContext';
import { languageStorage } from './src/utils/storage';
import { AuthProvider } from './src/context/AuthContext';
import { PremiumProvider } from './src/context/PremiumContext';
import { LocationProvider } from './src/context/LocationContext';
import { RootNavigator } from './src/navigation';
import { colors } from './src/theme';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from './src/queries/client';
import { useAppStateFocus, useOnlineBridge } from './src/queries/focus';
import { UpdateGate } from './src/components/update/UpdateGate';

// Tek istemci, uygulama ömrü boyunca. Render içinde yaratılırsa her render'da
// cache sıfırlanır ve tüm sorgular baştan çalışır.
const queryClient = createQueryClient();

/**
 * Odak/ağ köprüsünü provider'ın İÇİNDE kurmak için ince sarmalayıcı —
 * `focusManager` global olsa da hook'lar bir bileşen gövdesi gerektiriyor.
 */
function QueryBridges({ children }: { children: React.ReactNode }) {
  useAppStateFocus();
  useOnlineBridge();
  return <>{children}</>;
}

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  const [langReady, setLangReady] = React.useState(false);
  useEffect(() => {
    (async () => {
      const saved = await languageStorage.get();
      const device = Localization.getLocales?.()[0]?.languageCode ?? 'en';
      const initial = (SUPPORTED_LANGUAGES as readonly string[]).includes(saved ?? '')
        ? saved!
        : (SUPPORTED_LANGUAGES as readonly string[]).includes(device) ? device : 'en';
      await i18n.changeLanguage(initial);
      setLangReady(true);
    })();
  }, []);

  if (!fontsLoaded || !langReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background.default} />
        <QueryClientProvider client={queryClient}>
          <QueryBridges>
            <I18nextProvider i18n={i18n}>
              <LocaleProvider>
                <AuthProvider>
                  {/* Abonelik durumu Auth'un ICINDE: kullanici kimligi olmadan
                      RevenueCat'e kimlik verilemez ve kota sorgulanamaz. */}
                  <PremiumProvider>
                    <LocationProvider>
                    {/* Sürüm kapısı navigasyonu SARAR, yerine geçmez: kullanıcı
                        güncelledikten sonra giriş/sepet/gezinme durumu yerinde
                        kalsın. */}
                      <UpdateGate>
                        <RootNavigator />
                      </UpdateGate>
                    </LocationProvider>
                  </PremiumProvider>
                </AuthProvider>
              </LocaleProvider>
            </I18nextProvider>
          </QueryBridges>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
