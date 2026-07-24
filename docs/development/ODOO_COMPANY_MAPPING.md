# Odoo Company Mapping

**Durum:** Eşleme sözleşmesi hazır; canlı `res.company` kimlikleri bekleniyor.

**Tarih:** 24 Temmuz 2026

## 1. Kanonik kural

İş birimi eşlemesi yalnızca sabit `res.company.id` üzerinden yapılır. Şirket adı, `Şti.` son eki, para birimi veya personel adından tahmin yapılmaz.

Önceki konuşmalarda geçen `1 → Yurt İçi`, `2 → Yurt Dışı` değerleri yalnızca örnek niteliğindedir ve canlı sorguyla doğrulanmadan kullanılmayacaktır.

## 2. Beklenen iş birimleri

| Uygulama kodu | Görünen ad | Odoo company ID | Odoo kaynak adı | Para birimi | Durum |
|---|---|---:|---|---|---|
| `domestic` | Yurt İçi | Bekleniyor | Bekleniyor | Bekleniyor | pending |
| `international` | Yurt Dışı | Bekleniyor | Bekleniyor | Bekleniyor | pending |

## 3. Canlı keşif adımları

1. Entegrasyon kullanıcısıyla erişilebilen tüm `res.company` kayıtları okunur.
2. Her kayıt için `id`, `name`, `active`, `parent_id`, `currency_id` saklanır.
3. Owner, kaynak kayıtları Yurt İçi/Yurt Dışı görünen adlarıyla bir kez eşler.
4. Eşleme doğrulaması, her şirketten en az üç `sale.order` örneğiyle yapılır.
5. Eşleme değişikliği audit kaydı ve geçerlilik tarihi üretir.

## 4. Çok şirketli veri kuralları

- `sale.order.company_id` zorunlu kapsam anahtarıdır.
- `sale.order.line.company_id`, üst siparişle tutarlılık kontrolünde kullanılır.
- `res.partner.company_id = false` olan ortak partnerler şirketler arasında paylaşılabilir; rapor kapsamı partnerden değil satış kaydından belirlenir.
- `res.users.company_ids` erişim kapsamıdır; satış personelinin hangi rapora gireceği teklifin `company_id` değeriyle belirlenir.
- Manager kapsamı her sorguda sunucu tarafında uygulanır.

## 5. Kabul testleri

- Her Odoo şirket ID'si en fazla bir aktif iş birimine eşlenir.
- Yurt Dışı raporu yalnızca eşlenen şirket ID'sindeki `sale.order` kayıtlarını döndürür.
- Ortak müşteri iki şirkette teklif aldıysa her teklif kendi şirket kapsamında sayılır.
- Şirket adı değişse bile eşleme bozulmaz.
- Bilinmeyen company ID rapora sessizce dahil edilmez; veri kalitesi uyarısı üretir.
