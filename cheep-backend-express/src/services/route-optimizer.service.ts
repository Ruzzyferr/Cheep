/**
 * Route Optimizer Service
 * Mesafe hesaplamaları ve rota optimizasyonu
 */

// ============================================
// DISTANCE CALCULATION (HAVERSINE FORMULA)
// ============================================

interface Coordinates {
    lat: number;
    lon: number;
}

/**
 * Haversine formülü ile iki koordinat arası mesafeyi hesaplar (km)
 */
export function calculateDistance(point1: Coordinates, point2: Coordinates): number {
    const R = 6371; // Dünya yarıçapı (km)
    
    const dLat = toRadians(point2.lat - point1.lat);
    const dLon = toRadians(point2.lon - point1.lon);
    
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(point1.lat)) * Math.cos(toRadians(point2.lat)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 100) / 100; // 2 ondalık basamak
}

function toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
}

/**
 * Birden fazla market arasındaki toplam mesafeyi hesaplar
 * Kullanıcı konumundan başlayıp tüm marketleri dolaşır
 */
export function calculateRouteDistance(
    userLocation: Coordinates | null,
    stores: Array<{ lat: number | null; lon: number | null }>
): number {
    // Konum bilgisi eksikse varsayılan mesafe döndür
    const validStores = stores.filter(s => s.lat !== null && s.lon !== null);
    
    if (validStores.length === 0 || !userLocation) {
        return 0; // Mesafe hesaplanamıyor
    }

    let totalDistance = 0;
    let currentLocation = userLocation;

    // Her markete sırayla git
    for (const store of validStores) {
        const distance = calculateDistance(
            currentLocation,
            { lat: store.lat!, lon: store.lon! }
        );
        totalDistance += distance;
        currentLocation = { lat: store.lat!, lon: store.lon! };
    }

    // Son marketten eve dönüş mesafesi (opsiyonel)
    // totalDistance += calculateDistance(currentLocation, userLocation);

    return Math.round(totalDistance * 100) / 100;
}

/**
 * En kısa rotayı bulan basit TSP çözümü (Nearest Neighbor)
 * Not: Küçük market sayıları için yeterli
 */
export function optimizeStoreOrder(
    userLocation: Coordinates,
    stores: Array<{ id: number; lat: number; lon: number; name: string }>
): Array<typeof stores[0]> {
    if (stores.length === 0) return [];
    if (stores.length === 1) return stores;

    const visited: Set<number> = new Set();
    const optimizedRoute: typeof stores = [];
    let currentLocation: Coordinates = userLocation;

    // Greedy: Her adımda en yakın marketi seç
    while (visited.size < stores.length) {
        let nearestStore: typeof stores[0] | null = null;
        let minDistance = Infinity;

        for (const store of stores) {
            if (visited.has(store.id)) continue;

            const distance = calculateDistance(currentLocation, {
                lat: store.lat,
                lon: store.lon,
            });

            if (distance < minDistance) {
                minDistance = distance;
                nearestStore = store;
            }
        }

        if (nearestStore) {
            visited.add(nearestStore.id);
            optimizedRoute.push(nearestStore);
            currentLocation = { lat: nearestStore.lat, lon: nearestStore.lon };
        }
    }

    return optimizedRoute;
}

/**
 * Mesafe kategorisi
 */
export function getDistanceCategory(distance: number): string {
    if (distance === 0) return 'unknown';
    if (distance < 2) return 'very_close';
    if (distance < 5) return 'close';
    if (distance < 10) return 'moderate';
    if (distance < 20) return 'far';
    return 'very_far';
}

/**
 * Tahmini süre hesapla (saat)
 * Ortalama 40 km/h şehir içi hız + her market için 10 dk alışveriş süresi
 */
export function estimateDuration(distance: number, storeCount: number): number {
    const drivingTime = distance / 40; // Saat cinsinden
    const shoppingTime = (storeCount * 10) / 60; // 10 dk/market -> saat
    
    return Math.round((drivingTime + shoppingTime) * 100) / 100;
}

