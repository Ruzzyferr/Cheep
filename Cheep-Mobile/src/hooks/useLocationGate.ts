/**
 * Uygulama AÇILDIĞINDA (soğuk başlangıç) ve ARKA PLANDAN DÖNDÜĞÜNDE konumun
 * çalışır durumda olduğunu teyit eder; değilse istemi başlatır.
 *
 * "Açılış" iki şeydir ve ikisini de yakalamamız gerekir: process'in yeni başlaması
 * VE kullanıcının uygulamayı arka plandan öne getirmesi. İkincisi kritik — konum
 * izni tam olarak orada kaybolur (kullanıcı sistem ayarlarına gidip izni kapatır,
 * ya da Android kullanılmayan uygulamada izni kendisi geri alır).
 */
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { runLocationGate } from '../utils/locationGate';

export function useLocationGate(enabled: boolean): void {
  // Kapı aynı anda iki kez koşmasın: diyaloglar üst üste binerdi.
  const runningRef = useRef(false);
  const prevStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!enabled) return;

    const run = () => {
      if (runningRef.current) return;
      runningRef.current = true;
      runLocationGate().finally(() => {
        runningRef.current = false;
      });
    };

    run(); // soğuk başlangıç

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = prevStateRef.current;
      prevStateRef.current = next;
      // YALNIZCA gerçek arka plan → ön geçişinde. 'inactive' → 'active' geçişini
      // bilerek atlıyoruz: iOS'ta sistem izin modalı uygulamayı 'inactive' yapıp
      // geri getiriyor; onu "yeniden açılış" sayarsak kapı kendi modalını
      // tetiklediği için sonsuz döngüye girer.
      if (prev === 'background' && next === 'active') run();
    });

    return () => sub.remove();
  }, [enabled]);
}
