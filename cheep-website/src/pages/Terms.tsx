import { LegalLayout } from '../components/legal/LegalLayout'

export function Terms() {
  return (
    <LegalLayout title="Kullanım Şartları" updated="2 Temmuz 2026">
      <p>
        Cheep’i kullanarak bu şartları kabul etmiş olursun. Cheep, market fiyatlarını
        karşılaştırman için bilgi amaçlı bir araçtır.
      </p>

      <h2>Hizmetin niteliği</h2>
      <ul>
        <li>Fiyatlar marketlerin herkese açık kaynaklarından düzenli olarak toplanır ve her hafta güncellenir.</li>
        <li>Fiyatlar bilgilendirme amaçlıdır; markette geçerli olan güncel fiyattan farklı olabilir. Bağlayıcı olan marketin kasadaki fiyatıdır.</li>
        <li>Cheep bir satış noktası değildir; ürün satmaz, ödeme almaz.</li>
      </ul>

      <h2>Hesabın</h2>
      <ul>
        <li>Doğru bilgilerle kayıt olmalısın ve hesabının güvenliğinden sen sorumlusun.</li>
        <li>Hesabını dilediğin an <a href="/delete">silebilirsin</a>.</li>
      </ul>

      <h2>Sorumluluk sınırı</h2>
      <p>
        Cheep, fiyat bilgilerinin eksiksizliği veya güncelliği konusunda garanti vermez; bu
        bilgilere dayanarak verdiğin kararlardan doğan sonuçlardan sorumlu tutulamaz.
      </p>

      <h2>Değişiklikler</h2>
      <p>Bu şartları güncelleyebiliriz; güncel sürüm her zaman bu sayfada yayınlanır.</p>

      <h2>İletişim</h2>
      <p><a href="mailto:destek@cheep.live">destek@cheep.live</a></p>
    </LegalLayout>
  )
}
