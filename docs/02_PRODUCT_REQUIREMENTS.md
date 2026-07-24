# Product Requirements

## 1. Kimlik doğrulama

- Kullanıcı e-posta/kullanıcı adı ve parola ile giriş yapabilmelidir.
- Roller Owner ve Manager ile sınırlıdır.
- Owner kullanıcı oluşturabilir, pasifleştirebilir ve kapsam atayabilir.
- Başarısız giriş denemeleri sınırlandırılmalıdır.
- Oturumlar sunucu tarafında iptal edilebilir olmalıdır.

## 2. Manager ana ekranı

- Yayımlanmış raporlar kartlar halinde gösterilir.
- Kartta rapor adı, kısa açıklama, kategori ve son güncelleme bilgisi bulunur.
- Sık kullanılan veya son çalıştırılan raporlar öne çıkarılabilir.
- Teknik yönetim menüleri Manager’a gösterilmez.

## 3. Rapor çalıştırma

Her rapor kendi tanımına göre şu filtrelerden uygun olanları sunabilir:

- ay,
- yıl,
- özel tarih aralığı,
- iş birimi,
- personel,
- müşteri,
- durum,
- genel/personel/müşteri görünümü.

Filtreler kullanıcı dostu adlarla gösterilir. Odoo model ve alan isimleri gösterilmez.

## 4. Rapor sonucu

Sonuç ekranı şu katmanları desteklemelidir:

1. Rapor başlığı ve kapsam özeti
2. KPI kartları
3. Eğilim ve dağılım grafikleri
4. Personel veya müşteri karşılaştırma tablosu
5. Detay kayıtları
6. Veri güncellik ve hesaplama açıklamaları

## 5. Drill-down

- KPI veya grafik dilimine tıklanarak ilgili detay listeye inilebilmelidir.
- Teklif detayı; numara, müşteri, personel, durum, tarihler, para birimi ve tutar gibi izin verilen alanları gösterebilmelidir.
- Uygun olduğunda Odoo kaydına güvenli dış bağlantı sunulabilir.

## 6. Çıktılar

- Tarayıcı yazdırma görünümü
- PDF
- XLSX

PDF:

- ekran görüntüsü değil, özel baskı düzeni olmalıdır,
- sayfa kırılımları kontrollü olmalıdır,
- tüm personel raporunda her personelin grafik ve özet bölümü bulunmalıdır,
- rapor metadata’sını içermelidir.

XLSX:

- özet sayfası,
- detay veri sayfası,
- uygulanan filtreler,
- rapor üretim zamanı

içermelidir.

## 7. Owner paneli

Zorunlu bölümler:

- Kullanıcılar
- Odoo bağlantısı
- Şirket/iş birimi eşlemeleri
- Senkronizasyonlar
- Veri kalitesi
- Rapor şablonları
- Denetim kayıtları

## 8. Odoo bağlantısı

- Birincil bağlantı tanımlanabilmelidir.
- Bağlantı testi yapılabilmelidir.
- API anahtarı kayıt sonrası maskelenmelidir.
- Son başarılı istek ve son hata bilgisi gösterilmelidir.
- Odoo’ya yazma işlemi ilk sürümde engellenmelidir.

## 9. Senkronizasyon

- Artımlı senkronizasyon desteklenmelidir.
- Manuel senkronizasyon Owner tarafından başlatılabilmelidir.
- Senkronizasyon çalışmaları kayıt altına alınmalıdır.
- Başarısız kayıtlar yeniden denenebilmelidir.
- Her raporda son başarılı veri güncelleme zamanı görünmelidir.

## 10. Rapor yönetimi

İlk sürümde rapor ekranları kodla geliştirilebilir; ancak rapor metadata’sı veritabanında tutulmalıdır:

- ad,
- açıklama,
- kategori,
- yayın durumu,
- izin verilen roller,
- izin verilen iş birimleri,
- kullanılabilir filtreler,
- varsayılan görünüm,
- sürüm.

Gelişmiş Owner rapor oluşturucu sonraki faza bırakılır.

## 11. Erişilebilirlik ve kullanılabilirlik

- Klavye ile temel navigasyon
- Görünür odak göstergeleri
- Renk dışında durum anlatımı
- Yeterli kontrast
- Anlaşılır boş durum ve hata mesajları
- Uzun süren işlemlerde ilerleme göstergesi

## 12. Performans hedefleri

Normal veri hacminde:

- Dashboard ilk anlamlı görünüm: yaklaşık 2 saniye hedefi
- Önbellekli rapor: yaklaşık 2 saniye hedefi
- Tipik dinamik rapor: yaklaşık 5 saniye hedefi
- Uzun PDF/XLSX üretimi: arka plan görevi ve durum bildirimi

Bu değerler kesin SLA değil, tasarım hedefidir.
