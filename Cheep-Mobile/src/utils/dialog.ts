/**
 * 💬 Diyalog köprüsü
 *
 * Uygulamada işletim sisteminin kendi uyarı kutusu KULLANILMAZ. Android'in ve
 * iOS'un yerel modalları birbirinden farklı görünür, tipografimizi ve
 * renklerimizi taşımaz, maskotu gösteremez ve düğme sırasını platform belirler.
 * Bunun yerine tek bir tasarlanmış modal var (DialogHost).
 *
 * Köprü, o modalı React ağacının DIŞINDAN da çağırabilmek için var:
 * `utils/consent.ts`, `utils/linking.ts`, `notificationGate.ts` gibi saf
 * fonksiyonlar hook kullanamaz ama kullanıcıya soru sormak zorunda.
 *
 * Kullanım:
 *   showDialog({ title, message, buttons })         → ateşle ve unut
 *   await confirmDialog({ title, message, ... })    → true/false döner
 */

import { Alert } from 'react-native';
import type { MascotExpression } from '../components/brand/CheepMascot';

export type DialogButtonStyle = 'default' | 'cancel' | 'destructive';

export interface DialogButton {
  text: string;
  style?: DialogButtonStyle;
  onPress?: () => void | Promise<void>;
}

export type DialogTone = 'neutral' | 'danger' | 'premium';

export interface DialogOptions {
  title: string;
  message?: string;
  /** Verilmezse tek bir "Tamam" düğmesi çizilir. */
  buttons?: DialogButton[];
  /** Maskot ifadesi — premium/kutlama gibi sıcak anlarda. */
  mascot?: MascotExpression;
  /** Maskot yoksa gösterilecek ikon. */
  icon?: string;
  tone?: DialogTone;
  /** Arka plana dokununca kapansın mı (varsayılan: iptal düğmesi varsa evet). */
  dismissable?: boolean;
}

type Handler = (options: DialogOptions) => void;

let handler: Handler | null = null;

/** DialogHost mount olurken kendini kaydeder. */
export function registerDialogHandler(h: Handler | null): void {
  handler = h;
}

export function showDialog(options: DialogOptions): void {
  if (handler) {
    handler(options);
    return;
  }
  // Buraya normalde hiç düşülmez: DialogHost uygulama kökünde her zaman
  // mount'lu. Yine de sessizce yutmuyoruz — bir onay kutusunun kaybolması,
  // çirkin görünmesinden daha kötüdür.
  if (__DEV__) console.warn('DialogHost mount edilmemiş, yerel uyarıya düşülüyor:', options.title);
  Alert.alert(options.title, options.message);
}

/** Evet/hayır sorusu. Onaylanırsa true döner. */
export function confirmDialog(options: {
  title: string;
  message?: string;
  confirmText: string;
  cancelText: string;
  destructive?: boolean;
  mascot?: MascotExpression;
  icon?: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    showDialog({
      title: options.title,
      message: options.message,
      mascot: options.mascot,
      icon: options.icon,
      tone: options.destructive ? 'danger' : 'neutral',
      buttons: [
        { text: options.cancelText, style: 'cancel', onPress: () => resolve(false) },
        {
          text: options.confirmText,
          style: options.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
    });
  });
}

/**
 * `Alert.alert` ile BİREBİR aynı imza.
 *
 * Uygulamada 50 çağrı vardı; her birini elle nesne biçimine çevirmek yerine
 * imzayı koruyup çağrıları mekanik olarak taşıdık. Yeni kodda daha zengin olan
 * `showDialog` tercih edilmeli (maskot, ton, ikon).
 */
export function appAlert(
  title: string,
  message?: string,
  buttons?: DialogButton[],
  /** Alert.alert'ün 4. parametresiyle uyum: { cancelable } da kabul edilir. */
  extra?: Partial<DialogOptions> & { cancelable?: boolean }
): void {
  const { cancelable, ...rest } = extra ?? {};
  showDialog({
    title,
    message,
    buttons,
    ...(cancelable === undefined ? {} : { dismissable: cancelable }),
    ...rest,
  });
}
