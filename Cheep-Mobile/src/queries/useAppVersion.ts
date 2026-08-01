/**
 * Sürüm politikası sorgusu.
 *
 * Ekrana her dönüşte değil, uygulama her ÖNE GELDİĞİNDE tazelenir: eşiği
 * yükselttiğimizde açık duran uygulamalar da bir sonraki odakta kilitlenmeli.
 */
import { useQuery } from '@tanstack/react-query';
import { appVersionService } from '../services/appVersion.service';

export function useAppVersionPolicy() {
  return useQuery({
    queryKey: ['appVersionPolicy'],
    queryFn: () => appVersionService.getPolicy(),
    // Sunucu 5 dakika önbellekliyor; istemcide daha kısa tutmanın anlamı yok.
    staleTime: 5 * 60 * 1000,
    // Hata zaten null'a düşüyor (servis yutuyor); tekrar denemeye gerek yok.
    retry: 0,
  });
}
