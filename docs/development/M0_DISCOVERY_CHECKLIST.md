# M0 Discovery Checklist

**Son güncelleme:** 24 Temmuz 2026

**Durum:** M0 açık. Kaynak/dokümantasyon keşfi tamamlandı; canlı tenant keşfi bağlantı metadata'sı ve runtime secret bekliyor.

## Odoo ortamı

- [x] Kullanıcı beyan edilen ana sürümü kaydet: Odoo 19
- [ ] Minor/build sürümünü canlı endpoint ile doğrula
- [x] Uygun adaptörü doğrula: External JSON-2
- [ ] Base URL'yi doğrula
- [ ] API anahtarını yalnızca güvenli runtime ortamına ekle
- [ ] Entegrasyon kullanıcısının şirket erişimlerini doğrula
- [ ] Salt okunur ACL'i doğrula

## Şirketler

- [ ] `res.company` kayıtlarını çek
- [ ] Odoo şirket ID'lerini kaydet
- [ ] Yurt İçi/Yurt Dışı eşlemesini Owner ile onayla
- [ ] Ortak ve şirkete bağlı kayıt davranışını incele
- [x] ID tabanlı eşleme ve kabul kurallarını belgele

## Satış veri modeli

- [x] Odoo 19 standart `sale.order` kaynak alan başlangıcını çıkar
- [x] Odoo 19 standart `sale.order.line` kaynak alan başlangıcını çıkar
- [ ] Tenant `fields_get` sonuçlarını kaydet
- [ ] Studio `x_` ve `x_studio_` alanlarını envantere al
- [ ] Personel alanını gerçek kayıtlarla doğrula
- [ ] Müşteri alanını ve `commercial_partner_id` davranışını doğrula
- [x] Standart durum adaylarını çıkar: draft, sent, sale, cancel
- [x] `date_order` değişken semantik riskini belgele
- [ ] Tarih alanlarını gerçek kayıtlarla karşılaştır
- [ ] Para birimi alanlarını gerçek kayıtlarla doğrula

## Örnek veri doğrulama

En az şu kayıtları belirle:

- [ ] açık draft teklif
- [ ] gönderilmiş sent teklif
- [ ] onaylanmış teklif/sipariş
- [ ] iptal edilmiş teklif
- [ ] süresi dolmuş teklif
- [ ] ay sonunda oluşturulup sonraki ay onaylanan teklif
- [ ] farklı şirketten kayıt
- [ ] farklı para biriminden kayıt
- [ ] Studio özel alanı dolu kayıt
- [ ] personeli veya müşterisi eksik kayıt

## Tutarsızlık analizi

- [ ] Daha önce farklı sonuç veren kesin ayı kaydet
- [x] Kayıt ID bazlı karşılaştırma yöntemini tasarla
- [ ] Her iki rapordaki kayıt ID listelerini karşılaştır
- [ ] Farkları tarih, saat dilimi, durum, şirket, personel, müşteri ve join nedenleriyle sınıflandır
- [ ] Kanonik teklif sayımı kuralını gerçek veriyle onayla
- [ ] Beklenen KPI tablosunu manuel oluştur

## Teknik spike

- [ ] Version endpoint testi
- [ ] JSON-2 `/doc` ve model metadata testi
- [ ] Sayfalı `sale.order` okuma
- [ ] `write_date + id` cursor denemesi
- [ ] İki şirket kapsamı denemesi
- [ ] Rate/timeout davranışı
- [ ] Güvenli hata maskeleme
- [ ] Yazma yöntemlerinin istemci allowlist'inde bulunmadığını doğrula

## M0 çıkış paketi

- [x] `ODOO_FIELD_INVENTORY.md` — source baseline, tenant değerleri pending
- [x] `ODOO_COMPANY_MAPPING.md` — eşleme sözleşmesi, ID'ler pending
- [x] `REPORT_METRIC_DICTIONARY.md` — discovery sürümü, Owner onayı pending
- [x] `M0_DATA_VALIDATION_REPORT.md` — yöntem hazır, canlı sonuçlar pending
- [x] `M0_LIVE_DISCOVERY_RUNBOOK.md`
- [x] Fixture senaryo sözleşmesi — gerçek sanitize fixture pending
- [x] `M1_IMPLEMENTATION_PLAN.md` — M0 kapısına bağlı taslak

## M0 kapanış kriteri

Tüm canlı maddeler, Owner onaylı şirket eşlemesi, gerçek kayıt mutabakatı ve golden fixture tamamlanmadan M0 kapatılmaz; uygulama kodu M1'e başlamaz.
