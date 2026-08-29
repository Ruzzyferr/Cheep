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
import {
  loadCachedAvailableCountries,
  refreshAvailableCountries,
} from './src/utils/countryAvailability';
import { fetchAvailableCountryCodes } from './src/services/appVersion.service';
import { languageStorage } from './src/utils/storage';
import { AuthProvider } from './src/context/AuthContext';
import { PremiumProvider } from './src/context/PremiumContext';
import { AdsProvider } from './src/context/AdsContext';
import { LocationProvider } from './src/context/LocationContext';
import { RootNavigator } from './src/navigation';
import { colors } from './src/theme';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from './src/queries/client';
import { useAppStateFocus, useOnlineBridge, registerQueryClient } from './src/queries/focus';
import { UpdateGate } from './src/components/update/UpdateGate';
import { DialogHost } from './src/components/ui';
import { ErrorBoundary } from './src/components/ErrorBoundary';

// Tek istemci, uygulama ömrü boyunca. Render içinde yaratılırsa her render'da
// cache sıfırlanır ve tüm sorgular baştan çalışır.
const queryClient = createQueryClient();
// Ağ köprüsü bu istemcinin sorgu cache'ini dinleyerek çevrimiçi/çevrimdışı
// durumunu türetiyor (bkz. queries/focus.ts).
registerQueryClient(queryClient);

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

  // ÜLKE KULLANILABİLİRLİĞİ — önce diskteki son bilinen liste, sonra sunucu.
  //
  // Sıra önemli: diskten okuma anında biter ve ülke kapısı ilk render'dan
  // itibaren doğru çalışır; sunucu yanıtı geldiğinde liste sessizce tazelenir.
  // Ağ yoksa hiçbir şey olmaz, son bilinen liste geçerli kalır.
  //
  // AÇILIŞI BLOKLAMAZ: bu iş bitmeden de uygulama açılır — kapı en kötü
  // ihtimalle bir an için yedek listeyi (TR/PL) kullanır, ki o da doğru bir
  // cevaptır. Bkz. src/utils/countryAvailability.ts.
  useEffect(() => {
    (async () => {
      await loadCachedAvailableCountries();
      await refreshAvailableCountries(async () => (await fetchAvailableCountryCodes()) ?? []);
    })().catch(e => console.error('[App] ülke listesi başlatma hatası:', e));
  }, []);

  const [langReady, setLangReady] = React.useState(false);
  useEffect(() => {
    (async () => {
      const saved = await languageStorage.get();
      const device = Localization.getLocales?.()[0]?.languageCode ?? 'en';
      const initial = (SUPPORTED_LANGUAGES as readonly string[]).includes(saved ?? '')
        ? saved!
        : (SUPPORTED_LANGUAGES as readonly string[]).includes(device) ? device : 'en';
      await i18n.changeLanguage(initial);
    })()
      // `finally` ŞART: bu blok patlarsa (depo okuması, changeLanguage)
      // `langReady` sonsuza dek false kalıyor ve `App` aşağıda `null`
      // döndürüyordu — splash zaten kapanmış olduğu için kullanıcı KALICI
      // boş ekran görüyordu. Dil çözülemezse i18n varsayılanıyla devam et;
      // yanlış dilde bir uygulama, hiç açılmayan uygulamadan iyidir.
      .catch(e => console.error('[App] dil başlatma hatası:', e))
      .finally(() => setLangReady(true));
  }, []);

  if (!fontsLoaded || !langReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background.default} />
        {/* Hata sınırı SAĞLAYICILARIN DIŞINDA: bir context sağlayıcısının
            kendisi render sırasında patlarsa da yakalanmalı. İçeride olsaydı
            tam da en çok gereken durumda birlikte sökülürdü. */}
        <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <QueryBridges>
            <I18nextProvider i18n={i18n}>
              <LocaleProvider>
                <AuthProvider>
                  {/* Abonelik durumu Auth'un ICINDE: kullanici kimligi olmadan
                      RevenueCat'e kimlik verilemez ve kota sorgulanamaz. */}
                  <PremiumProvider>
                    {/* Reklam sağlayıcısı PremiumProvider'ın İÇİNDE: abonelik
                        durumu bilinmeden reklam SDK'sı başlatılmamalı. Abone
                        tam olarak "reklamsız" için ödedi ve SDK'yı başlatmanın
                        kendisi veri topluyor (bkz. context/AdsContext.tsx). */}
                    <AdsProvider>
                    <LocationProvider>
                    {/* Sürüm kapısı navigasyonu SARAR, yerine geçmez: kullanıcı
                        güncelledikten sonra giriş/sepet/gezinme durumu yerinde
                        kalsın. */}
                      <UpdateGate>
                        <RootNavigator />
                      </UpdateGate>
                      {/* Uygulamanin TEK uyari/onay kutusu — isletim sisteminin
                          yerel modali hicbir yerde kullanilmiyor. En disda:
                          her ekranin ustunde cizilmeli. */}
                      <DialogHost />
                    </LocationProvider>
                    </AdsProvider>
                  </PremiumProvider>
                </AuthProvider>
              </LocaleProvider>
            </I18nextProvider>
          </QueryBridges>
        </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
