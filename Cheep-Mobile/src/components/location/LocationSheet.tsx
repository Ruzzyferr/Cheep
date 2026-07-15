/**
 * 📍 Konum sayfası — Otomatik / Sabit adres seçimi.
 *
 * Hiçbir geocoder sonucu sessizce kabul edilmez: kullanıcı aday listesinden
 * birini seçmeden hiçbir şey kaydedilmez (bkz. validateCandidate akışı).
 * "no_branches" durumunda koordinat UYDURULMAZ — kullanıcı onaylarsa
 * koordinatsız (yalnızca ülke) pin kaydedilir.
 *
 * ÜLKE-YALNIZCA SEÇİM (3. kapı + çıkış kapısı): geocoder çalışmayan cihazlarda
 * adres araması imkânsızdır; kullanıcı yine de ülkesini seçebilmelidir. Aynı
 * butonlar bir KİLİTLENME TUZAĞINI da açar: konum rızası olmayan bir kullanıcı
 * yabancı bir ülkeyi sabitlerse (user_country oraya yazılır), "otomatiğe dön"
 * dediğinde detectedCountry null olur ve resolveAnchor lastCountry'ye (=pin'in
 * yazdığı yabancı ülke) düşer — kullanıcı yanlış katalog/para biriminde MAHSUR
 * kalırdı. Butonlar coords: null ile pin'ler → mesafe filtresi kapalı kalır,
 * boş ekran riski yoktur; ve seçim kullanıcının AÇIK tercihidir (sessiz kabul değil).
 * TEK İSTİSNA: çapa ZATEN o ülkedeyse VE koordinatlıysa buton DEVRE DIŞIDIR —
 * o dokunuş yalnızca çalışan bir pin'i (adres + mesafe filtresi) sessizce çöpe
 * atardı; koordinatsız çapada ise buton açık kalır, çünkü çıkış kapısı odur.
 *
 * KAPATMA KURALI: sheet HİÇBİR KOŞULDA kullanıcıyı hapsetmez. onRequestClose,
 * header ✕'i ve geri linki her zaman çalışır — bir yazma (pin/unpin) sürüyor
 * olsa bile. Bunun güvenli olmasının sebebi LocationContext.refresh()'in artık
 * eşzamanlı çağrıları DÜŞÜRMEYİP BİRLEŞTİRMESİ: sheet kapanıp yeniden açılsa
 * bile, geç gelen bir pin()/unpin() sonunda depodaki GERÇEK durumu okuyup
 * yayınlar. Sheet'in tek görevi, o geç cevabı kendi ekranına (stale UI olarak)
 * YAZMAMAK — bunu epoch (nesil) sayacı sağlar.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocationAnchor } from '../../context/LocationContext';
import { searchAddress, validateCandidate, type GeocodeCandidate } from '../../services/geocode.service';
import type { PinnedAnchor } from '../../utils/anchor';
import { SUPPORTED_COUNTRY_CODES } from '../../utils/geo';
import { Button } from '../ui';
import { colors, typography, spacing, borderRadius, layout } from '../../theme';

type SearchState =
  | { kind: 'idle' }
  | { kind: 'unavailable' }
  | { kind: 'not_found' }
  | { kind: 'error' }
  | { kind: 'results'; candidates: GeocodeCandidate[] };

// Bir adayın doğrulanması sırasında akış hangi aşamaya girdi.
type ValidationFlow =
  | { kind: 'none' }
  | { kind: 'checking'; label: string }
  | { kind: 'unsupported'; label: string }
  | { kind: 'no_branches'; label: string; pin: PinnedAnchor }
  | { kind: 'error' };

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function LocationSheet({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { anchor, pin, unpin } = useLocationAnchor();

  // Sheet her açıldığında mevcut çapaya göre başlasın (önceki kalıntı state sızmasın).
  const [selectedMode, setSelectedMode] = useState<'auto' | 'pinned'>(anchor?.mode ?? 'auto');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchState, setSearchState] = useState<SearchState>({ kind: 'idle' });
  const [flow, setFlow] = useState<ValidationFlow>({ kind: 'none' });
  const [confirming, setConfirming] = useState(false);
  // Ülke-yalnızca pin yazılırken hangi ülke yazılıyor (null → yazma yok).
  // Diğer yükleniyor bayraklarıyla AYNI kurala tabidir: her epoch artışında
  // sıfırlanır, finally'de yalnızca epoch uyuşuyorsa indirilir.
  const [pinningCountry, setPinningCountry] = useState<string | null>(null);

  // RN'in <Modal> bileşeni visible={false} olduğunda children'ı UNMOUNT ETMEZ,
  // yalnızca native görünümü gizler — bileşen örneği, state'i ve devam eden
  // promise'ler canlı kalır. Bu yüzden önceki bir açılışta başlatılan bir arama
  // ya da doğrulama isteği, sheet kapatılıp yeniden açıldıktan sonra bile
  // sonuçlanıp state'e yazabilir. "epoch" sayacı BUNU engeller — TEK işi budur:
  // her reset ve her yeni aramada artar; async bir cevap geldiğinde yakalanan
  // epoch ile güncel epoch karşılaştırılır, uyuşmuyorsa cevap sessizce terk
  // edilir (ne UI state'i yazılır ne de onClose() çağrılır, çünkü ekranın
  // sahibi artık başka bir session'dır). epoch bir İPTAL mekanizması DEĞİLDİR
  // ve sheet'in kapatılmasını hiçbir şekilde geciktirmez/engellemez.
  const epochRef = useRef(0);

  // Reset YALNIZCA gerçek bir false→true (açılış) geçişinde koşar. Önceki hali
  // [visible, anchor?.mode] dinliyordu ve bu KRİTİK bir hataydı: anchor.mode'u
  // değiştiren şey sheet'in KENDİ pin()/unpin() çağrısıdır. Yani sheet kendi
  // epoch'unu kendi yazması sırasında artırıyor, handler'ın `epochRef.current
  // !== epoch` kontrolü tutuyor ve onClose() ATLANIYORDU. Yarışı reset'in
  // kazanması için refresh()'in setAnchor'dan SONRA bir kez daha await etmesi
  // yeterli — ki ÜLKE DEĞİŞTİĞİNDE tam olarak bunu yapıyor (setCountry +
  // userService.updatePreferences). Sonuç: Türkiye'deki kullanıcı Varşova'yı
  // sabitliyor, pin kaydediliyor, ülke geçiyor ama MODAL AÇIK KALIYOR ve boş bir
  // "sabit adres" ekranına resetleniyor — "hiçbir şey olmadı" gibi görünüyor.
  // Aynısı yabancı bir pin'i kaldırırken ("otomatiğe dön") de oluyordu.
  const wasVisibleRef = useRef(false);
  // Açılış anında mod seçiciyi mevcut çapadan tohumlamak için — efektin bağımlılık
  // listesine anchor.mode'u KOYMADAN (bkz. yukarıdaki hata). Ref her render'da
  // güncellenir, efekt yalnızca açılışta okur.
  const anchorModeRef = useRef(anchor?.mode);
  anchorModeRef.current = anchor?.mode;

  // Kullanıcı mod butonlarından BİRİNE dokundu mu? GPS fix'i saniyeler
  // sürebilir: sheet çapa çözülmeden açılabilir, kullanıcı "Sabit adres"e
  // dokunup adres yazmaya başlayabilir. Çapa 'auto' olarak indiğinde aşağıdaki
  // tohumlama efekti (anchorResolvedRef) selectedMode'u GERİ ALIP kullanıcının
  // az önce başlattığı etkileşimi altından çeker. Bu ref true olduğunda o efekt
  // devre dışı kalır — kullanıcının kendi seçimi asla ezilmez. Yalnızca sheet'in
  // AÇILIŞ geçişinde sıfırlanır (aşağıdaki reset efekti), böylece bir sonraki
  // taze açılış yine normal tohumlanır.
  const modeTouchedRef = useRef(false);

  useEffect(() => {
    const wasVisible = wasVisibleRef.current;
    wasVisibleRef.current = visible;
    if (!visible || wasVisible) return; // yalnızca kapalı → açık geçişi

    // Sheet yeniden açıldı: önceki açılıştan kalma isteklerin cevaplarını
    // geçersiz kılmak için epoch'u artırıyoruz. (Bu özellik KORUNDU: her epoch
    // artışı, aynı commit'te TÜM yükleniyor bayraklarının sıfırlanmasıyla
    // eşleşir — hiçbir bayrak asılı kalamaz.)
    epochRef.current += 1;
    setSelectedMode(anchorModeRef.current ?? 'auto');
    setQuery('');
    setSearching(false);
    setSearchState({ kind: 'idle' });
    setFlow({ kind: 'none' });
    setConfirming(false);
    setPinningCountry(null);
    // Taze açılış: kullanıcının önceki oturumdan kalma bir mod dokunuşu bu
    // yeni oturumu ETKİLEMEMELİ — aşağıdaki tohumlama efekti yeniden normal
    // çalışsın.
    modeTouchedRef.current = false;
  }, [visible]);

  // Sheet, çapa daha ÇÖZÜLMEDEN (anchor === null) açılabilir: soğuk açılışta
  // provider'ın ilk refresh()'i (izin kapısı + GPS) sürerken kullanıcı Profil'e
  // gidip ülke satırına dokunabilir. O anda yukarıdaki reset selectedMode'u
  // 'auto'ya tohumlar ve çapa 'pinned' olarak indiğinde seçici YANLIŞ modda
  // kalırdı (kullanıcının sabit adresi var ama ekran "Otomatik" diyor).
  //
  // Bu efekt YALNIZCA "null → çözüldü" GEÇİŞİNDE ve yalnızca selectedMode'u
  // tohumlar. C3'e geri DÖNMEZ: reset efektinin bağımlılığına anchor.mode
  // EKLENMİYOR; burada epoch ARTIRILMIYOR ve başka HİÇBİR state (query, searching,
  // searchState, flow, confirming, pinningCountry) sıfırlanmıyor. Sheet'in kendi
  // pin()/unpin() yazması anchor'ı null'dan çıkarmaz (zaten çözülmüştür), o yüzden
  // bu efekt o yazma sırasında KOŞMAZ ve onClose() yarışını yeniden açmaz.
  //
  // modeTouchedRef KONTROLÜ: kullanıcı çapa çözülmeden ÖNCE bir mod butonuna
  // dokunduysa (bkz. modeTouchedRef tanımı), bu geç gelen tohumlama artık
  // kullanıcının kendi seçimini geçersiz kılmamalı — o yüzden burada bailout.
  const anchorResolvedRef = useRef(anchor != null);
  useEffect(() => {
    const wasResolved = anchorResolvedRef.current;
    anchorResolvedRef.current = anchor != null;
    if (!visible || wasResolved || anchor == null || modeTouchedRef.current) return;
    setSelectedMode(anchor.mode);
  }, [visible, anchor]);

  // Sheet İÇİNDEKİ etkileşimli kontroller (bir doğrulama 'checking', bir onay
  // 'confirming' ya da bir ülke-yalnızca pin yazması sürerken) burada kilitlenir —
  // amaç, aynı anda ikinci bir pin()/unpin() yazmasının başlamasını önlemektir.
  // busy, dismissal'ı (kapatmayı) ETKİLEMEZ — o her zaman serbesttir, bkz. handleClose.
  const busy = flow.kind === 'checking' || confirming || pinningCountry !== null;

  // Sheet'i kapatan TEK yol — Android geri tuşu (onRequestClose), header ✕'i
  // ve "otomatiğe dön" linki hep buna gider. HİÇBİR KOŞULDA no-op olmaz:
  // önceki hatalı düzeltme burayı bir yazma sürerken kilitliyordu, bu da
  // validateCandidate()/pin() ağ hatasıyla patladığında kullanıcıyı sheet'e
  // kalıcı olarak hapsediyordu. Artık kapatma bir yazmanın bitmesini beklemez.
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleUseAuto = useCallback(async () => {
    if (busy) return; // aynı anda ikinci bir yazma başlatma
    // Kullanıcı BİZZAT "Otomatik" modunu seçti — geç gelen tohumlama efekti
    // (anchorResolvedRef) bu seçimi artık ezmemeli (bkz. modeTouchedRef tanımı).
    modeTouchedRef.current = true;
    const epoch = epochRef.current;
    try {
      await unpin();
      // await sırasında sheet kapatılıp yeniden açılmış olabilir — epoch
      // değiştiyse bu artık bayat: onClose() çağırırsak başka bir session'ı
      // bizim yerimize kapatmış oluruz.
      if (epochRef.current !== epoch) return;
      onClose();
    } catch {
      // unpin() (ve içindeki refresh()) ağ/depo hatasıyla patlayabilir.
      // Sheet açık ve kapatılabilir kalmaya devam eder — kullanıcı ✕ ile her
      // zaman çıkabilir; burada özel bir hata göstergesine gerek yok çünkü bu
      // buton kendi başına bir "checking/confirming" durumu sergilemiyor.
    }
  }, [unpin, onClose, busy]);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    // busy (checking/confirming) sürerken klavyeden de, butondan da yeni bir
    // arama başlatılamaz — aksi halde epoch burada artar ama 'checking' ya da
    // 'confirming' o yazmayı hâlâ sürdürür ve kendi epoch'u artık bayat kalır
    // (bkz. dosya başı ve handleConfirmNoBranches notları). Buton zaten
    // disabled={busy} ile korunuyordu; TextInput'un onSubmitEditing'i de aynı
    // kapıdan geçmeli — aksi halde klavyenin "ara" tuşu bu korumayı bypass eder.
    if (!q || searching || busy) return;
    // Yeni bir arama başlıyor: epoch'u artırıyoruz ki bu arama başlamadan
    // önce fırlatılmış (henüz sonuçlanmamış) eski bir aramanın cevabı bu
    // sonuçların üzerine yazamasın.
    epochRef.current += 1;
    const epoch = epochRef.current;
    setSearching(true);
    setFlow({ kind: 'none' });
    try {
      const result = await searchAddress(q);
      // await sırasında sheet kapatılıp yeniden açılmış ya da yeni bir arama
      // başlatılmış olabilir (bkz. üstteki epoch açıklaması) — o zaman bu
      // artık bayat cevabı state'e yazmadan sessizce terk ediyoruz.
      if (epochRef.current !== epoch) return;
      if (!result.available) {
        setSearchState({ kind: 'unavailable' });
      } else if (result.candidates.length === 0) {
        setSearchState({ kind: 'not_found' });
      } else {
        setSearchState({ kind: 'results', candidates: result.candidates });
      }
    } catch {
      // searchAddress kendi içindeki geocoder hatalarını zaten yakalayıp
      // available:false döndürüyor; buraya düşen her şey beklenmedik bir
      // hatadır — "unavailable" (cihaz geocoder'ı yok) ile KARIŞTIRMADAN
      // ayrı, genel bir mesaj gösteriyoruz.
      if (epochRef.current === epoch) setSearchState({ kind: 'error' });
    } finally {
      // KURAL: bayat bir çağrı, YÜKLENIYOR bayrakları dahil hiçbir state'i
      // daha yeni bir epoch'un üzerine YAZAMAZ. searching de istisna değil —
      // epoch değiştiyse bu artık başka bir arama (ya da sheet kapanıp yeniden
      // açılmış) demektir ve o session'ın kendi searching bayrağı zaten var;
      // burada koşulsuz false yazarsak GÜNCEL aramanın spinner'ını erken
      // kapatmış oluruz. Bir aramanın sonsuza dek asılı kalmaması ise reset
      // effect'in garantisi: sheet her yeniden açılışta searching'i sıfırlar
      // (bkz. dosya başı) ve handleSearch busy'yken (checking/confirming
      // sürerken) epoch'u hiç artırmaz — dolayısıyla temizlenmeyi bekleyen bir
      // "öksüz" epoch hiç oluşmaz.
      if (epochRef.current === epoch) setSearching(false);
    }
  }, [query, searching, busy]);

  const handleSelectCandidate = useCallback(async (c: GeocodeCandidate) => {
    // Bu doğrulamanın hangi epoch'ta başladığını yakalıyoruz.
    const epoch = epochRef.current;
    setFlow({ kind: 'checking', label: c.label });
    try {
      const v = await validateCandidate(c);
      // await sırasında sheet kapatılıp yeniden açılmış ya da yeni bir arama
      // başlatılmış olabilir — epoch değiştiyse bu artık bayat cevabı
      // (ör. eski bir "no_branches" uyarısını) ekrana yansıtmadan çıkıyoruz.
      if (epochRef.current !== epoch) return;
      if (v.status === 'unsupported_country') {
        setFlow({ kind: 'unsupported', label: c.label });
        return;
      }
      if (v.status === 'no_branches') {
        // coords zaten null geldi — burada asla koordinat ÜRETİLMEZ,
        // validateCandidate'in döndürdüğü pin aynen taşınır.
        setFlow({ kind: 'no_branches', label: c.label, pin: v.pin });
        return;
      }
      // status === 'ok' — koordinatlı doğrulanmış pin, doğrudan kaydet.
      await pin(v.pin);
      // İKİNCİ await: pin() hem depolamaya yazıyor hem de provider'ın
      // refresh()'i ile ağ isteği yapabiliyor. Bu sürede sheet kapatılıp
      // yeniden açılmış olabilir — epoch değiştiyse onClose() ARTIK BU
      // SESSION'A AİT DEĞİL; yine de çağırırsak yeni açılmış session'ı
      // bizim yerimize kapatmış oluruz. (Depoya geç yazan pin() artık
      // zararsız: LocationContext.refresh() eşzamanlı çağrıları birleştirip
      // depodaki GERÇEK durumu yayınlıyor — bkz. dosya başı not.)
      if (epochRef.current !== epoch) return;
      onClose();
    } catch {
      // KRİTİK düzeltme: eskiden burada try/finally YOKTU. validateCandidate()
      // ya da pin() ağ hatasıyla patlarsa flow 'checking'de SONSUZA DEK asılı
      // kalıyor, ve önceki (hatalı) düzeltme her kapatma yolunu bu duruma
      // bağladığı için kullanıcı sheet'e KALICI OLARAK HAPSOLUYORDU. Artık
      // kapatma flow'a bağlı değil (bkz. handleClose); burada sadece
      // spinner'ı temizleyip genel bir hata mesajı gösteriyoruz.
      if (epochRef.current === epoch) setFlow({ kind: 'error' });
    } finally {
      // Bu epoch'ta flow hâlâ 'checking'de asılıysa (örn. yukarıdaki catch
      // atlanmadıysa da) burada kesin olarak temizleniyor — spinner hiçbir
      // koşulda asılı kalmaz. Fonksiyonel updater en güncel state'i okur.
      if (epochRef.current === epoch) {
        setFlow((f) => (f.kind === 'checking' ? { kind: 'none' } : f));
      }
    }
  }, [pin, onClose]);

  const handleConfirmNoBranches = useCallback(async () => {
    if (flow.kind !== 'no_branches' || confirming) return;
    // Bu onayın hangi epoch'ta başladığını yakalıyoruz.
    const epoch = epochRef.current;
    const pendingPin = flow.pin; // coords zaten null — burada asla üretilmez.
    // Aday satırlarıyla tutarlı olsun diye pin() sürerken butonu meşgul
    // gösterip devre dışı bırakıyoruz — art arda dokunmayla çifte pin() çağrısını önler.
    setConfirming(true);
    try {
      await pin(pendingPin);
      // await sırasında epoch değişmiş olabilir — değiştiyse bu artık bayat
      // bir onay: onClose() çağırırsak yeni açılmış session'ı kapatırız.
      if (epochRef.current !== epoch) return;
      onClose();
    } catch {
      // pin() (ve içindeki refresh()) ağ/depo hatasıyla patlayabilir. Sheet
      // yine de açık ve kapatılabilir kalır; genel hata mesajını gösteriyoruz.
      if (epochRef.current === epoch) setFlow({ kind: 'error' });
    } finally {
      // confirming'i epoch uyuşuyorsa indiriyoruz — KOŞULSUZ DEĞİL. KURAL:
      // bayat bir çağrının finally'si, yükleniyor bayrakları dahil hiçbir
      // state'i daha yeni bir epoch'un üzerine YAZAMAZ. Önceki (hatalı)
      // düzeltme "kendi spinner'ını temizlemek her zaman güvenlidir" diye
      // varsayıyordu; review bunun somut kırılma senaryosunu gösterdi: sheet
      // kapanıp yeniden açılınca (epoch E1→E2) reset effect confirming'i
      // false'a çeker ama bayat pin(A) promise'i canlı kalır (RN Modal
      // unmount etmez); kullanıcı E2'de tekrar Continue'a basıp pin(B)'yi
      // başlatır (confirming=true); bayat pin(A) sonuçlanıp finally'si
      // KOŞULSUZ çalışsaydı E2'nin confirming=true'sunu false'a çekip busy'yi
      // erken indirir, pin(B) hâlâ sürerken mod seçici/Continue/geri linkini
      // yeniden etkinleştirip ikinci bir eşzamanlı yazmaya izin verirdi.
      // Bir bayrağın sonsuza dek asılı kalmaması reset effect'in garantisi:
      // sheet her yeniden açılışta confirming'i sıfırlar (bkz. dosya başı) ve
      // handleSearch busy'yken (confirming sürerken) epoch'u hiç artırmaz —
      // dolayısıyla temizlenmeyi bekleyen bir "öksüz" epoch hiç oluşmaz.
      if (epochRef.current === epoch) setConfirming(false);
    }
  }, [flow, confirming, pin, onClose]);

  // Ülke-yalnızca pin — 3. kapının (geocoder yok) karşılığı ve her zaman açık
  // çıkış kapısı (bkz. dosya başı). KOORDİNAT ÜRETİLMEZ: coords null → çapa
  // koordinatsız → shouldFilterByDistance() false → mesafe filtresi kapalı.
  const handleSelectCountry = useCallback(async (countryCode: string) => {
    if (busy) return; // aynı anda ikinci bir yazma başlatma
    // Bu yazmanın hangi epoch'ta başladığını yakalıyoruz (diğer handler'larla aynı kural).
    const epoch = epochRef.current;
    setPinningCountry(countryCode);
    setFlow({ kind: 'none' });
    try {
      await pin({ coords: null, countryCode, label: t(`countries.${countryCode}`) });
      // await sırasında sheet kapatılıp yeniden açılmış olabilir — epoch
      // değiştiyse onClose() artık bu session'a ait değil.
      if (epochRef.current !== epoch) return;
      onClose();
    } catch {
      // pin() (ve içindeki refresh()) ağ/depo hatasıyla patlayabilir; sheet açık
      // ve kapatılabilir kalır, genel hata mesajı gösterilir.
      if (epochRef.current === epoch) setFlow({ kind: 'error' });
    } finally {
      // Bayat bir çağrı, yükleniyor bayrakları dahil hiçbir state'i daha yeni bir
      // epoch'un üzerine YAZAMAZ (bkz. handleConfirmNoBranches'teki uzun not).
      // Asılı kalma riski yok: epoch yalnızca açılışta (bayrakların hepsi aynı
      // commit'te sıfırlanır) ya da handleSearch'te (busy iken hiç artmaz) artar.
      if (epochRef.current === epoch) setPinningCountry(null);
    }
  }, [busy, pin, onClose, t]);

  const candidates = searchState.kind === 'results' ? searchState.candidates : [];
  const checkingLabel = flow.kind === 'checking' ? flow.label : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Alt güvenli alan (sistem gezinme çubuğu) için paddingBottom inset'le
            büyütülür — yoksa "otomatiğe dön" ve ülke butonları 3-tuşlu/gesture
            çubuğunun altında kalır. Değer StyleSheet'te sabit olamaz (cihaza göre
            değişir), o yüzden inline. */}
        <View style={[styles.sheet, { paddingBottom: layout.screenPadding + insets.bottom }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('location.title')}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={8}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={styles.body}>
            {/* Mod seçici */}
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeBtn, selectedMode === 'auto' && styles.modeBtnActive]}
                onPress={handleUseAuto}
                disabled={busy}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="my-location"
                  size={16}
                  color={selectedMode === 'auto' ? colors.background.paper : colors.text.secondary}
                />
                <Text style={[styles.modeBtnText, selectedMode === 'auto' && styles.modeBtnTextActive]}>
                  {t('location.mode_auto')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, selectedMode === 'pinned' && styles.modeBtnActive]}
                onPress={() => {
                  // Kullanıcı BİZZAT "Sabit adres" modunu seçti — geç gelen
                  // tohumlama efekti bu seçimi artık ezmemeli (bkz. modeTouchedRef).
                  modeTouchedRef.current = true;
                  setSelectedMode('pinned');
                }}
                disabled={busy}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="push-pin"
                  size={16}
                  color={selectedMode === 'pinned' ? colors.background.paper : colors.text.secondary}
                />
                <Text style={[styles.modeBtnText, selectedMode === 'pinned' && styles.modeBtnTextActive]}>
                  {t('location.mode_pinned')}
                </Text>
              </TouchableOpacity>
            </View>

            {selectedMode === 'pinned' && (
              <View style={styles.pinnedSection}>
                {anchor?.mode === 'pinned' && anchor.label && (
                  <Text style={styles.currentPin}>
                    {t('location.chip_pinned', { label: anchor.label })}
                  </Text>
                )}

                <View style={styles.searchRow}>
                  <TextInput
                    style={styles.input}
                    placeholder={t('location.address_placeholder')}
                    placeholderTextColor={colors.text.hint}
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                    editable={!busy}
                  />
                  <TouchableOpacity
                    style={[styles.searchBtn, (searching || !query.trim() || busy) && styles.searchBtnDisabled]}
                    onPress={handleSearch}
                    disabled={searching || !query.trim() || busy}
                    activeOpacity={0.8}
                  >
                    {searching ? (
                      <ActivityIndicator size="small" color={colors.background.paper} />
                    ) : (
                      <Text style={styles.searchBtnText}>{t('location.search')}</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {searching && (
                  <Text style={styles.helperText}>{t('location.searching')}</Text>
                )}
                {!searching && searchState.kind === 'unavailable' && (
                  <Text style={styles.errorText}>{t('location.geocoder_unavailable')}</Text>
                )}
                {!searching && searchState.kind === 'not_found' && (
                  <Text style={styles.errorText}>{t('location.not_found')}</Text>
                )}
                {!searching && searchState.kind === 'error' && (
                  <Text style={styles.errorText}>{t('common.something_went_wrong')}</Text>
                )}

                {/* Aday listesi — kullanıcı birini seçmeden hiçbir şey kaydedilmez. */}
                {candidates.map((c, i) => {
                  const isChecking = checkingLabel === c.label;
                  return (
                    <View key={`${c.label}-${i}`} style={styles.candidateRow}>
                      <Text style={styles.candidateLabel} numberOfLines={2}>
                        {c.label}
                      </Text>
                      <TouchableOpacity
                        style={styles.useThisBtn}
                        onPress={() => handleSelectCandidate(c)}
                        disabled={busy}
                        activeOpacity={0.8}
                      >
                        {isChecking ? (
                          <ActivityIndicator size="small" color={colors.primary.main} />
                        ) : (
                          <Text style={styles.useThisText}>{t('location.use_this')}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}

                {flow.kind === 'unsupported' && (
                  <View style={[styles.warnBox, styles.errorBox]}>
                    <MaterialIcons name="block" size={18} color={colors.error.main} />
                    <Text style={styles.warnText}>{t('location.unsupported_country')}</Text>
                  </View>
                )}

                {flow.kind === 'error' && (
                  <View style={[styles.warnBox, styles.errorBox]}>
                    <MaterialIcons name="error-outline" size={18} color={colors.error.main} />
                    <Text style={styles.warnText}>{t('common.something_went_wrong')}</Text>
                  </View>
                )}

                {flow.kind === 'no_branches' && (
                  <View style={styles.warnBox}>
                    <MaterialIcons name="info-outline" size={18} color={colors.warning.main} />
                    <Text style={styles.warnText}>{t('location.no_branches')}</Text>
                    <View style={styles.warnActions}>
                      <Button
                        title={t('common.cancel')}
                        variant="outline"
                        size="small"
                        onPress={() => setFlow({ kind: 'none' })}
                        disabled={confirming}
                        style={styles.warnActionBtn}
                      />
                      <Button
                        title={t('common.continue')}
                        size="small"
                        onPress={handleConfirmNoBranches}
                        disabled={busy}
                        loading={confirming}
                        style={styles.warnActionBtn}
                      />
                    </View>
                  </View>
                )}

                {/* Ülke-yalnızca seçim. Geocoder çalışmasa bile (3. kapı) kullanıcı
                    ülkesini seçebilir; yanlış ülkeye sabitlenmiş kullanıcı da buradan
                    geri dönebilir. Koordinat YOK → mesafe filtresi kapalı → boş ekran
                    riski yok. Sessiz kabul değil: dokunmak açık bir kullanıcı seçimidir. */}
                <View style={styles.countrySection}>
                  <Text style={styles.countryTitle}>{t('location.country_only_title')}</Text>
                  <Text style={styles.countryHint}>{t('location.country_only_hint')}</Text>
                  <View style={styles.countryRow}>
                    {SUPPORTED_COUNTRY_CODES.map((code) => {
                      const active = anchor?.countryCode === code;
                      const writing = pinningCountry === code;
                      // Buton "seçili" görünüyor ama CANLI bir eylem: dokunmak
                      // pin({ coords: null }) yazar. Çapa ZATEN bu ülkedeyse VE
                      // GERÇEKTEN SABİTLENMİŞ (mode:'pinned') koordinatlı bir
                      // adresse (doğrulanmış adres, mesafeler çalışıyor), dokunuş
                      // yalnızca AŞAĞI ÇEKEBİLİR: adres etiketi ve mesafe filtresi,
                      // no-op gibi görünen bir dokunuşla SESSİZCE gider. Böyle bir
                      // dokunuşu hiç başlatmıyoruz. mode kontrolü KASITLI: OTOMATİK
                      // moddaki koordinatlı bir GPS fix'i korumaya değer bir "pin"
                      // DEĞİLDİR — o kullanıcı sabit bir adres seçmemiştir, en
                      // yakın şube her yarıçapın dışındaysa koordinatsız pin'e geçiş
                      // TEK çıkış kapısıdır ve bu buton onu engellememelidir.
                      // Çapanın koordinatı YOKSA (ya da mode 'auto' ise) buton
                      // AÇIK KALIR — yanlış ülkeye sabitlenmiş kullanıcının ya da
                      // kırık geocoder'lı otomatik-mod kullanıcısının çıkış kapısı
                      // odur (bkz. dosya başı) ve kaybedecek bir şey yoktur.
                      const wouldOnlyDowngrade =
                        active && anchor?.mode === 'pinned' && anchor.coords != null;
                      return (
                        <TouchableOpacity
                          key={code}
                          style={[styles.countryBtn, active && styles.countryBtnActive]}
                          onPress={() => handleSelectCountry(code)}
                          disabled={busy || wouldOnlyDowngrade}
                          activeOpacity={0.8}
                        >
                          {writing ? (
                            <ActivityIndicator size="small" color={colors.primary.main} />
                          ) : (
                            <Text
                              style={[styles.countryBtnText, active && styles.countryBtnTextActive]}
                            >
                              {t(`countries.${code}`)}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <TouchableOpacity onPress={handleUseAuto} disabled={busy} style={styles.backLink}>
                  <Text style={styles.backLinkText}>{t('location.back_to_auto')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '85%',
    // paddingBottom inline verilir (layout.screenPadding + güvenli alan inset'i).
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: layout.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  title: { ...typography.styles.h4, color: colors.text.primary, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  closeText: { fontSize: 20, color: colors.text.secondary },

  body: { paddingHorizontal: layout.screenPadding },

  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.main,
    backgroundColor: colors.background.default,
  },
  modeBtnActive: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  modeBtnText: { ...typography.styles.body2, color: colors.text.secondary, fontWeight: '600' },
  modeBtnTextActive: { color: colors.background.paper },

  pinnedSection: { marginTop: spacing.lg },

  currentPin: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },

  searchRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1,
    height: layout.inputHeight,
    borderWidth: 1,
    borderColor: colors.border.main,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    ...typography.styles.body1,
    color: colors.text.primary,
    backgroundColor: colors.background.default,
  },
  searchBtn: {
    minWidth: 76,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnDisabled: { opacity: 0.5 },
  searchBtnText: { ...typography.styles.button, color: colors.background.paper, fontSize: 14 },

  helperText: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  errorText: {
    ...typography.styles.caption,
    color: colors.error.main,
    marginTop: spacing.sm,
  },

  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: spacing.sm,
  },
  candidateLabel: { flex: 1, ...typography.styles.body2, color: colors.text.primary },
  useThisBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.primary.main,
    minWidth: 84,
    alignItems: 'center',
  },
  useThisText: { ...typography.styles.caption, color: colors.primary.main, fontWeight: '700' },

  warnBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.warning.bg,
    gap: spacing.xs,
  },
  errorBox: { backgroundColor: colors.error.bg },
  warnText: { ...typography.styles.body2, color: colors.text.primary },
  warnActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  warnActionBtn: { flex: 1 },

  countrySection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  countryTitle: {
    ...typography.styles.body2,
    color: colors.text.primary,
    fontWeight: '700',
  },
  countryHint: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  countryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  countryBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.main,
    backgroundColor: colors.background.default,
    minWidth: 96,
    alignItems: 'center',
  },
  countryBtnActive: { borderColor: colors.primary.main, backgroundColor: colors.primary[50] },
  countryBtnText: { ...typography.styles.body2, color: colors.text.primary, fontWeight: '600' },
  countryBtnTextActive: { color: colors.primary.main, fontWeight: '700' },

  backLink: { marginTop: spacing.lg, alignItems: 'center', paddingVertical: spacing.sm },
  backLinkText: { ...typography.styles.body2, color: colors.primary.main, fontWeight: '600' },
});
