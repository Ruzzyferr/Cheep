import { LegalLayout } from '../components/legal/LegalLayout'

export function Privacy() {
  return (
    <LegalLayout title="Gizlilik Politikası" updated="2 Temmuz 2026">
      <p>
        Cheep (“biz”, “uygulama”) olarak gizliliğine önem veriyoruz. Bu politika, Cheep mobil
        uygulamasını ve <strong>cheep.live</strong> sitesini kullandığında hangi verileri
        topladığımızı, neden topladığımızı ve haklarını açıklar. Cheep, marketlerin fiyatlarını
        karşılaştıran bir tasarruf uygulamasıdır; verini <strong>satmayız</strong>.
      </p>

      <h2>Topladığımız veriler</h2>
      <h3>Sen sağladığın için</h3>
      <ul>
        <li><strong>Hesap bilgileri:</strong> e-posta adresin, adın ve şifren (şifren asla düz metin olarak saklanmaz, bcrypt ile geri döndürülemez şekilde şifrelenir).</li>
        <li><strong>Tercihler:</strong> ülke ve dil seçimin.</li>
        <li><strong>Uygulama içeriği:</strong> oluşturduğun alışveriş listeleri, favori marketlerin, verdiğin fiyat geri bildirimleri ve Cheep Asistan’a yazdığın mesajlar.</li>
      </ul>
      <h3>İzin verdiğinde</h3>
      <ul>
        <li><strong>Yaklaşık konum:</strong> yalnızca izin verirsen ve sana en yakın market şubelerini göstermek için kullanılır. Konumun sürekli takip edilmez, arka planda toplanmaz.</li>
      </ul>
      <h3>Otomatik olarak</h3>
      <ul>
        <li><strong>Temel teknik veriler:</strong> uygulamanın çalışması ve hataların giderilmesi için gerekli standart günlük kayıtları (ör. cihaz tipi, hata kayıtları).</li>
      </ul>

      <h2>Verileri neden kullanıyoruz</h2>
      <ul>
        <li>Ürünleri barkodundan eşleştirip market fiyatlarını karşılaştırmak.</li>
        <li>Sana en yakın ve en uygun şubeyi göstermek.</li>
        <li>Hesabını oluşturmak, girişini ve e-posta doğrulamanı sağlamak.</li>
        <li>Cheep Asistan ile sorularını yanıtlamak.</li>
        <li>Uygulamayı geliştirmek ve güvenliğini korumak.</li>
      </ul>

      <h2>Üçüncü taraflarla paylaşım</h2>
      <p>Verini pazarlama amacıyla satmayız. Yalnızca hizmetin çalışması için gerekli sınırlı paylaşımlar olur:</p>
      <ul>
        <li><strong>Cheep Asistan (yapay zekâ):</strong> asistana yazdığın mesajlar, yanıt üretmek için Google’ın Gemini servisine iletilir.</li>
        <li><strong>E-posta:</strong> doğrulama ve bilgilendirme e-postaları Resend altyapısı üzerinden gönderilir.</li>
        <li><strong>Market yönlendirmeleri:</strong> bir markete ait bağlantıya dokunduğunda ilgili marketin sitesine yönlendirilirsin; bu sırada kişisel bilgin paylaşılmaz.</li>
        <li><strong>Yasal zorunluluk:</strong> hukuken gerekli olduğunda yetkili mercilerle paylaşılabilir.</li>
      </ul>

      <h2>Verinin güvenliği</h2>
      <p>
        Uygulama ile sunucularımız arasındaki tüm trafik HTTPS (TLS) ile şifrelenir. Şifreler
        bcrypt ile hash’lenir. Yine de internet üzerinden hiçbir aktarımın %100 güvenli
        olmadığını hatırlatırız.
      </p>

      <h2>Verinin saklanması ve silinmesi</h2>
      <p>
        Verilerini hesabın aktif olduğu sürece saklarız. Dilediğin an hesabını ve tüm ilişkili
        verilerini kalıcı olarak silebilirsin:
      </p>
      <ul>
        <li>Uygulamada <strong>Profil → Hesabımı Sil</strong> adımından, veya</li>
        <li><a href="/delete">cheep.live/delete</a> sayfasındaki formdan.</li>
      </ul>
      <p>
        Silme işlemi geri alınamaz; listelerin, favori marketlerin, geri bildirimlerin ve
        asistan sohbetlerin dahil tüm verilerin kalıcı olarak kaldırılır.
      </p>

      <h2>Haklarının (KVKK / GDPR)</h2>
      <p>
        Verilerine erişme, düzeltilmesini veya silinmesini isteme, işlemeye itiraz etme
        haklarına sahipsin. Bu haklarını kullanmak için <a href="mailto:gizlilik@cheep.live">gizlilik@cheep.live</a> adresine yazabilirsin.
      </p>

      <h2>Çocuklar</h2>
      <p>Cheep 13 yaş altındaki çocuklara yönelik değildir ve bilerek onlardan veri toplamaz.</p>

      <h2>Değişiklikler</h2>
      <p>
        Bu politikayı zaman zaman güncelleyebiliriz. Önemli değişikliklerde uygulama veya
        e-posta yoluyla bilgilendiririz. Güncel sürüm her zaman bu sayfada yer alır.
      </p>

      <h2>İletişim</h2>
      <p>
        Sorular için: <a href="mailto:gizlilik@cheep.live">gizlilik@cheep.live</a>
      </p>
    </LegalLayout>
  )
}
