# Reporting Domain

## 1. Merkezi metrik ilkesi

Bir metrik yalnızca tek bir kanonik tanıma sahip olmalıdır. Ekran, PDF ve Excel aynı reporting service sonucunu kullanır.

Her metrik tanımı şunları içerir:

- benzersiz kod,
- kullanıcı görünen adı,
- açıklama,
- veri kaynağı,
- filtre kuralları,
- tarih ekseni,
- hesaplama yöntemi,
- sürüm,
- geçerlilik tarihi.

## 2. İlk rapor: Yurt Dışı Aylık Teklif Performansı

### Filtreler

- ay/yıl,
- özel tarih aralığı,
- iş birimi,
- personel,
- müşteri,
- durum,
- görünüm modu.

### KPI’lar

- Toplam teklif
- Gerçekleşen
- Açık
- Gerçekleşmeyen
- Dönüşüm oranı
- Teklif verilen müşteri sayısı
- Ortalama sonuçlanma süresi, veri uygunsa

### Görünümler

#### Genel

Tüm seçili kapsamın özeti ve personel karşılaştırması.

#### Personel

Her personel için KPI, aylık eğilim, durum dağılımı, müşteri özeti ve teklif listesi.

#### Müşteri

Müşteri başına teklif sayısı, sonuç dağılımı, son teklif tarihi ve detaylar.

## 3. Teklif kohortu

“Bu ay kaç teklif yapıldı?” sorusunun varsayılan yanıtı teklifin ilk oluşturulduğu döneme göre hesaplanır. Odoo 19 standart modelinde bunun ilk kanonik alan adayı `sale.order.create_date` değeridir. Onaylandığı dönem ayrı bir tarih ekseni olarak raporlanır.

`sale.order.date_order` teklif üretim kohortu için kullanılmaz; bu alan taslak/gönderilmiş kayıtta oluşturma tarihini, onaylı kayıtta onay tarihini temsil edebildiği için kayıt durum değiştirince ay değiştirebilir. Varsa özel Studio teklif tarihi alanı M0'da `create_date` ile kayıt bazında karşılaştırılır.

Bu ayrım sayesinde geçmişte oluşturulan bir teklif daha sonra sipariş olduğunda teklif üretim performansı başka aya taşınmaz. Kesin alan seçimi canlı mutabakat ve metrik sözlüğü onayıyla sürümlenir.

## 4. Durumlar

Önerilen iş tanımı:

- **Gerçekleşti:** siparişe dönüşmüş kayıt.
- **Açık:** karar verilmemiş ve geçerliliğini koruyan kayıt.
- **İptal:** kaynakta iptal edilmiş kayıt.
- **Süresi doldu:** geçerlilik tarihi geçmiş, siparişe dönüşmemiş kayıt.
- **Gerçekleşmedi:** rapor sunumunda iptal ve süresi dolmuş kayıtların birleşimi; detayda alt durum korunur.
- **Belirsiz:** eksik veya tanımsız veri.

Açık teklifler gerçekleşmedi sayılmaz.

## 5. Para birimi

- Gerçek `currency_id` her zaman saklanır.
- İlk yurt dışı raporunda ana odak adet metrikleridir.
- Tutar sunulacaksa para birimi açıkça gösterilir.
- Farklı para birimleri toplamı, kur dönüşüm kuralı olmadan tek rakamda birleştirilmez.
- İş ihtiyacı gereği USD varsayımı kullanılan özel görünüm varsa bu durum raporda görünür biçimde belirtilir.

## 6. Rapor metadata’sı

Her rapor şu bilgileri taşımalıdır:

- rapor adı ve sürümü,
- oluşturulma zamanı,
- son veri senkronizasyon zamanı,
- filtreler,
- tarih ekseni,
- iş birimi kapsamı,
- metrik tanımı sürümü,
- canlı veya snapshot sonucu.

## 7. Snapshot

Yönetim toplantısı gibi durumlarda rapor sonucu dondurulabilir. Snapshot:

- rapor tanımını,
- filtreleri,
- sonuç özetini,
- oluşturma zamanını,
- üretici kullanıcıyı

saklar. İlk MVP’de zorunlu değildir; veri modeli buna hazır olmalıdır.

## 8. İleride eklenecek raporlar

- Personel Performansı
- Müşteri Teklif Geçmişi
- Açık ve Yaşlanan Teklifler
- Tekliften Siparişe Dönüşüm
- Ürün ve Ürün Grubu Eğilimleri
- Satış Siparişleri
- Satın Alma
- Stok
- Üretim

Her yeni rapor ortak filtre, metric ve export sözleşmelerini yeniden kullanmalıdır.
