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

“Bu ay kaç teklif yapıldı?” sorusunun kanonik yanıtı teklifin ilk oluşturulduğu döneme göre hesaplanır. Canlı Odoo 19.0+e tenant doğrulaması sonucunda tarih ekseni kesin olarak `sale.order.create_date` seçilmiştir.

`sale.order.date_order` teklif üretim kohortu için kullanılmaz. 100 onaylı kayıt örneğinin 55 tanesinde `date_order`, `create_date` sonrasına taşınmış; 4 kayıt takvim ayı sınırını geçmiş ve maksimum 147,86 gün fark gözlenmiştir. Bu alan onaylanmış kayıtlarda sipariş/onay dönemi için ayrı bir tarih ekseni olarak kullanılabilir.

```text
Teklif üretim dönemi = month(sale.order.create_date)
Sipariş/onay dönemi = month(sale.order.date_order), yalnızca onaylı kayıtlar
```

Bu ayrım sayesinde geçmişte oluşturulan bir teklif daha sonra sipariş olduğunda teklif üretim performansı başka aya taşınmaz.

Canlı `sale.order` modelinde Studio veya başka `x_` özel alan bulunmadığı doğrulanmıştır. Tenant modeli ileride değişirse alan envanteri yeniden çalıştırılır ve metrik sürümü artırılır.

## 4. İş birimi kapsamı

İş birimi eşlemesi yalnızca sabit `res.company.id` üzerinden yapılır:

- **Yurt Dışı:** `company_id = 1`, kaynak para birimi USD (`currency_id = 1`)
- **Yurt İçi:** `company_id = 25`, kaynak para birimi TRY (`currency_id = 31`)

İki şirketin görünen adları yalnızca noktalama farkıyla ayrıldığı için şirket adı, son ek veya para birimi runtime eşleme anahtarı olamaz.

İlk raporun varsayılan kapsamı Yurt Dışı, yani `sale.order.company_id = 1` olacaktır. Manager erişim kapsamı ayrıca uygulama veritabanındaki iş birimi izinleriyle sunucu tarafında sınırlandırılır.

## 5. Durumlar

Canlı kaynak durum seçenekleri:

- `draft` — Quotation
- `sent` — Quotation Sent
- `sale` — Sales Order
- `cancel` — Cancelled

Kanonik iş tanımı:

- **Gerçekleşti:** `state = sale`.
- **Açık:** `state in (draft, sent)` ve teklif henüz süresi dolmamış.
- **İptal:** `state = cancel`.
- **Süresi doldu:** `state in (draft, sent)` ve geçerlilik tarihi geçmiş.
- **Gerçekleşmedi:** rapor sunumunda İptal + Süresi doldu; detayda alt durum korunur.
- **Belirsiz:** eksik veya tanımsız veri.

Açık teklifler gerçekleşmedi sayılmaz. `validity_date` boş kayıtların nasıl sınıflandırılacağı canlı örneklerle M2 içinde ayrıca doğrulanacaktır.

İlk canlı veri kalite taramasında iki `sale.order` kaydında `user_id` boş bulunmuştur. Bu kayıtlar sessizce dışlanmaz; ilk normalizasyonda açık bir **Atanmamış** personel kovasına alınır ve kayıt bazlı inceleme tamamlanır.

## 6. Para birimi

- Gerçek `currency_id` her zaman saklanır.
- İlk yurt dışı raporunda ana odak adet metrikleridir.
- Tutar sunulacaksa para birimi açıkça gösterilir.
- Farklı para birimleri toplamı, kur dönüşüm kuralı olmadan tek rakamda birleştirilmez.
- İş ihtiyacı gereği USD varsayımı kullanılan özel görünüm varsa bu durum raporda görünür biçimde belirtilir.

## 7. Rapor metadata’sı

Her rapor şu bilgileri taşımalıdır:

- rapor adı ve sürümü,
- oluşturulma zamanı,
- son veri senkronizasyon zamanı,
- filtreler,
- tarih ekseni,
- iş birimi kapsamı,
- metrik tanımı sürümü,
- canlı veya snapshot sonucu.

## 8. Snapshot

Yönetim toplantısı gibi durumlarda rapor sonucu dondurulabilir. Snapshot:

- rapor tanımını,
- filtreleri,
- sonuç özetini,
- oluşturma zamanını,
- üretici kullanıcıyı

saklar. İlk MVP’de zorunlu değildir; veri modeli buna hazır olmalıdır.

## 9. İleride eklenecek raporlar

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
