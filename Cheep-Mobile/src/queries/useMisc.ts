/**
 * Marketler, fırsatlar, bildirimler ve profil sorguları.
 * Tek dosyada: her biri tek bir hook ve ortak bir desen izliyor.
 */
import { useQuery } from '@tanstack/react-query';
import { storeService, notificationService, profileService } from '../services';
import { qk } from './keys';
import { useScope } from './scope';
import { STALE } from './client';

export function useStores() {
    const scope = useScope();
    return useQuery({
        queryKey: qk.stores.all(scope),
        queryFn: () => storeService.getStores(),
        staleTime: STALE.static,
    });
}

/**
 * Okunmamış bildirim sayısı — anasayfadaki zil rozeti.
 * `STALE.live`: bildirim ekranından çıkınca rozet inatla durmamalı.
 */
export function useUnreadCount() {
    return useQuery({
        queryKey: qk.notifications.unreadCount(),
        queryFn: () => notificationService.unreadCount(),
        staleTime: STALE.live,
    });
}

export function useProfile(enabled = true) {
    return useQuery({
        queryKey: qk.profile.me(),
        queryFn: () => profileService.getProfile(),
        enabled,
        staleTime: STALE.catalog,
    });
}
