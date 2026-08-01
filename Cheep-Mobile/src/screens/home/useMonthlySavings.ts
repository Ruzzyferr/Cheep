/**
 * 💰 Bu ay ve geçen ay toplam tasarruf.
 *
 * Tamamlanmış listelerin her biri için ayrı bir karşılaştırma isteği gerekiyor;
 * bu yüzden `MAX` ile sınırlı. Anasayfanın ana veri akışından AYRI bir sorgu:
 * bu hesap yavaş ve kritik değil, hero kartının geri kalanı onu beklememeli.
 */
import { useQuery } from '@tanstack/react-query';
import { listService } from '../../services';
import { compareInsights } from '../../utils/compareInsights';
import { useScope } from '../../queries/scope';

/** Kaç tamamlanmış liste için karşılaştırma çalıştırılacak. */
const MAX_LISTS = 6;

export interface MonthlySavings {
    /** Bu ayki toplam tasarruf. */
    total: number;
    /** Geçen aya göre fark (pozitifse artış). */
    increase: number;
}

export function useMonthlySavings() {
    const scope = useScope();

    return useQuery({
        queryKey: ['monthlySavings', scope.country],
        queryFn: async (): Promise<MonthlySavings> => {
            const completed = await listService.getLists('completed');

            const now = new Date();
            const curMonth = now.getMonth();
            const curYear = now.getFullYear();
            const prevMonth = curMonth === 0 ? 11 : curMonth - 1;
            const prevYear = curMonth === 0 ? curYear - 1 : curYear;
            const inMonth = (d: Date, m: number, y: number) =>
                d.getMonth() === m && d.getFullYear() === y;

            const relevant = completed
                .filter((l) => {
                    if (!l.completed_at) return false;
                    const d = new Date(l.completed_at);
                    return inMonth(d, curMonth, curYear) || inMonth(d, prevMonth, prevYear);
                })
                .sort(
                    (a, b) =>
                        new Date(b.completed_at as string).getTime() -
                        new Date(a.completed_at as string).getTime(),
                )
                .slice(0, MAX_LISTS);

            let total = 0;
            let previous = 0;

            for (const list of relevant) {
                const completedAt = new Date(list.completed_at as string);
                try {
                    const result = await listService.compareList(list.id, {
                        maxStores: 3,
                        includeMissingProducts: true,
                    });
                    const savings = compareInsights(result.strategies).savings || 0;
                    if (inMonth(completedAt, curMonth, curYear)) total += savings;
                    else previous += savings;
                } catch {
                    // Tek bir listenin karşılaştırması patlarsa toplamı
                    // düşürüp devam et — hero kartı hiç sayı göstermemektense
                    // eksik göstersin.
                }
            }

            return { total: Math.round(total), increase: Math.round(total - previous) };
        },
        // Geçmiş aylara ait toplam; sık tazelemenin anlamı yok ama liste
        // tamamlanınca `['lists']` invalidation'ı bunu da düşürmez —
        // bilinçli: kullanıcı listeyi tamamladığında sayı bir sonraki
        // açılışta güncellenir, o an ağır bir hesap tetiklenmez.
        staleTime: 10 * 60 * 1000,
    });
}
