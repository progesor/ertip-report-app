# M2 Tenant Discovery

## Amaç

Bu dilim, gerçek Odoo tenant verisini henüz yerel rapor tablolarına bağlamadan önce canlı model, şirket, tarih ve veri kalite doğrulaması sağlar.

Keşif yalnızca Owner rolüne açıktır ve Odoo üzerinde yalnızca şu salt okunur yöntemleri kullanır:

- `fields_get`
- `search_read`
- `search_count`

API anahtarı response, audit metadata, browser state veya repository içine yazılmaz.

## Uygulama yüzeyi

Owner dashboard içindeki **Tenant Keşfini Çalıştır** eylemi şu endpoint'i çağırır:

```text
POST /api/owner/odoo/discovery
```

Endpoint aynı-origin kontrolü ve `admin:connections` yetkisi gerektirir.

## Keşfedilen kapsam

### Tenant ve şirketler

- canlı Odoo sürümü
- erişilebilir `res.company` kayıtları
- şirket ID, ad, aktiflik, üst şirket ve para birimi
- entegrasyon kullanıcısının okuyabildiği şirket ID kapsamı
- birden fazla şirket okunabiliyorsa multi-company doğrulaması

Yurt İçi / Yurt Dışı eşlemesi şirket adına göre otomatik tahmin edilmez. Owner, canlı sonuçtaki sabit `res.company.id` değerlerini kullanarak eşlemeyi sonraki dilimde onaylar.

### Kullanıcı şirket kapsamı

`res.users` erişilebiliyorsa görünür kullanıcılar aşağıdaki güvenli alanlarla listelenir:

- kullanıcı ID
- görünen ad
- maskelenmiş login
- varsayılan şirket ID
- izinli şirket ID'leri
- keşfedilen tüm şirketleri kapsayıp kapsamadığı

Tam login response içinde gösterilmez. Entegrasyon hesabı Owner tarafından ad ve maskeli login üzerinden belirlenir.

### Model ve alan envanteri

Aşağıdaki modeller için `fields_get` çalıştırılır:

- `res.company`
- `res.users`
- `res.partner`
- `res.currency`
- `sale.order`

Her model için toplam alan sayısı, erişim durumu, hedef alan eksikleri ve `x_` / `x_studio_` özel alan sayısı raporlanır.

`sale.order` için aşağıdaki standart adaylar ve tüm özel alanlar detaylı gösterilir:

- `user_id`
- `partner_id`
- `company_id`
- `currency_id`
- `state`
- `create_date`
- `date_order`
- `amount_total`
- `validity_date`
- `write_date`
- `team_id`
- tüm `x_` ve `x_studio_` alanları

Alan metadata raporu etiket, tip, ilişki, zorunluluk, salt okunurluk, storage ve selection seçeneklerini içerir.

## Tarih semantiği doğrulaması

Keşif, en fazla 100 açık ve 100 onaylı `sale.order` kaydından yalnızca şu alanları okur:

- `id`
- `state`
- `create_date`
- `date_order`

Müşteri, teklif adı, tutar veya satır detayı bu örneklemde okunmaz.

Onaylı kayıtlarda `date_order`, `create_date` sonrasına taşınmışsa veya ay sınırını geçmişse teklif üretim cohort'u için `create_date` önerilir. Canlı örneklem yeterli kanıt üretmezse sonuç `needs_review` kalır ve tarih alanı varsayılmaz.

## Veri kalite temel raporu

Keşif aşağıdaki sayısal kontrolleri üretir:

- toplam `sale.order` sayısı
- canlı `state` selection değerlerine göre kayıt sayıları
- boş `user_id`
- boş `partner_id`
- boş `company_id`
- boş `currency_id`
- boş `create_date`
- boş `date_order`

Bir model veya sorgu ACL nedeniyle okunamazsa tüm keşif düşürülmez; ilgili bölüm güvenli hata koduyla kısmi sonuç verir. `res.company` erişimi temel ön koşuldur ve okunamıyorsa keşif başarısız sayılır.

## Production doğrulama akışı

1. Feature branch PR'ı tüm CI kapılarından geçer.
2. PR `main` dalına merge edilir ve Coolify production deploy tamamlanır.
3. Owner olarak `https://report.progesor.net/` adresine giriş yapılır.
4. Önce mevcut Odoo bağlantı testi çalıştırılır.
5. **Tenant Keşfini Çalıştır** seçilir.
6. Şirket ID/ad sonuçları ile Yurt İçi ve Yurt Dışı eşlemesi onaylanır.
7. Entegrasyon kullanıcısının iki şirketi de kapsadığı doğrulanır.
8. `sale.order` özel alanları ve tarih kanıt kayıtları incelenir.
9. Sonuçlar secret veya ham müşteri verisi içermeyen M2 alan eşleme karar belgesine işlenir.

## Sonraki dilim

Canlı keşif sonucu doğrulandıktan sonra:

- şirket ID → iş birimi eşlemesi PostgreSQL'e alınır,
- onaylı alan eşleme sözlüğü sürümlenir,
- müşteri, salesperson ve `sale.order` sync tabloları tasarlanır,
- cursor ve idempotent upsert akışı uygulanır,
- ilk seçili dönem mutabakatı yapılır.
