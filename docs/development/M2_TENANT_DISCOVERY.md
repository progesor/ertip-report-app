# M2 Tenant Discovery

## Amaç

Bu dilim, gerçek Odoo tenant verisini henüz yerel rapor tablolarına bağlamadan önce canlı model, şirket, tarih ve veri kalite doğrulaması sağlar.

Keşif yalnızca Owner rolüne açıktır ve Odoo üzerinde yalnızca şu salt okunur yöntemleri kullanır:

- `fields_get`
- `search_read`
- `search_count`

API anahtarı response, audit metadata, browser state veya repository içine yazılmaz.

## Uygulama yüzeyleri

Owner dashboard içindeki **Tenant Keşfini Çalıştır** eylemi şu endpoint'i çağırır:

```text
POST /api/owner/odoo/discovery
```

Endpoint aynı-origin kontrolü ve `admin:connections` yetkisi gerektirir.

Şirket bazlı satış kapsamı ve güvenli atanmamış teklif incelemesi için:

```text
GET /api/owner/odoo/coverage
```

Coverage endpoint'i `admin:data-quality` yetkisi gerektirir, cache edilmez ve yalnızca güvenli teknik metadata döndürür.

## Keşfedilen kapsam

### Tenant ve şirketler

- canlı Odoo sürümü
- erişilebilir `res.company` kayıtları
- şirket ID, ad, aktiflik, üst şirket ve para birimi
- entegrasyon kullanıcısının okuyabildiği şirket ID kapsamı
- birden fazla şirket okunabiliyorsa multi-company doğrulaması

Canlı eşleme doğrulanmıştır:

```text
Yurt Dışı -> res.company.id = 1
Yurt İçi   -> res.company.id = 25
```

Şirket adı, noktalama, son ek veya para birimi runtime eşleme anahtarı değildir.

### Kullanıcı şirket kapsamı

`res.users` erişilebiliyorsa görünür kullanıcılar aşağıdaki güvenli alanlarla listelenir:

- kullanıcı ID
- görünen ad
- maskelenmiş login
- varsayılan şirket ID
- izinli şirket ID'leri
- keşfedilen tüm şirketleri kapsayıp kapsamadığı

Tam login response içinde gösterilmez. Görünür kullanıcı listesi runtime API key sahibini tek başına kanıtlamaz; entegrasyon hesabı ayrıca operasyonel olarak doğrulanır.

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

Canlı tenant kanıtı sonucunda teklif üretim kohortu kesin olarak `create_date` seçilmiştir. `date_order`, onay sonrası değişebildiği için teklif üretim ayını belirlemez.

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

25 Temmuz 2026 canlı doğrulamasında durum dağılımı toplam `6.875` kayıtla tam mutabakat sağlamıştır:

```text
draft  = 1.088
sent   = 1
sale   = 5.717
cancel = 69
```

Bir model veya sorgu ACL nedeniyle okunamazsa tüm keşif düşürülmez; ilgili bölüm güvenli hata koduyla kısmi sonuç verir. `res.company` erişimi temel ön koşuldur ve okunamıyorsa keşif başarısız sayılır.

## Şirket bazlı coverage diagnostics

Coverage endpoint'i sorguları sırayla ve geçici Odoo hatalarında sınırlı retry ile çalıştırır. Her erişilebilir şirket için:

- toplam `sale.order` sayısı,
- `draft`, `sent`, `sale`, `cancel` sayıları,
- durum toplamının şirket toplamıyla mutabakatı,
- boş `user_id` sayısı

üretilir.

Atanmamış kayıt örneği yalnızca şu alanları içerebilir:

- `sale.order.id`
- `company_id`
- `state`
- `create_date`
- `date_order`

Müşteri, teklif adı, tutar, satır içeriği veya iletişim bilgisi okunmaz ve döndürülmez.

## Production doğrulama akışı

1. Feature branch PR'ı tüm CI kapılarından geçer.
2. PR `main` dalına merge edilir ve Coolify production deploy tamamlanır.
3. Owner olarak `https://report.progesor.net/` adresine giriş yapılır.
4. Önce mevcut Odoo bağlantı testi çalıştırılır.
5. **Tenant Keşfini Çalıştır** seçilir.
6. Şirket ID/ad sonuçları ve tarih semantiği doğrulanır.
7. Authenticated Owner oturumunda `/api/owner/odoo/coverage` açılır.
8. Şirket `1` ve `25` toplamları kendi durum toplamlarıyla mutabık olmalıdır.
9. İki şirket toplamı global `6.875` sayısıyla mutabık olmalıdır.
10. Atanmamış iki kaydın yalnızca güvenli metadata'sı incelenir.
11. Sonuçlar secret veya ham müşteri verisi içermeyen M2 karar belgesine işlenir.

## Sonraki dilim

Coverage ve geçerlilik tarihi örnekleri doğrulandıktan sonra:

- şirket ID → iş birimi eşlemesi PostgreSQL'e alınır,
- onaylı alan eşleme sözlüğü sürümlenir,
- müşteri, salesperson ve `sale.order` sync tabloları tasarlanır,
- cursor ve idempotent upsert akışı uygulanır,
- ilk seçili dönem mutabakatı yapılır.
