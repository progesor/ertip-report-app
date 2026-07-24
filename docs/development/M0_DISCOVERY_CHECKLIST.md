# M0 Discovery Checklist

## Odoo ortamı

- [ ] Odoo kesin sürümünü kaydet
- [ ] Base URL’yi doğrula
- [ ] API anahtarını güvenli test ortamına ekle
- [ ] Entegrasyon kullanıcısının şirket erişimlerini doğrula
- [ ] Salt okunur erişimi test et

## Şirketler

- [ ] `res.company` kayıtlarını çek
- [ ] Odoo şirket ID’lerini kaydet
- [ ] Yurt İçi/Yurt Dışı eşlemesini onayla
- [ ] Ortak ve şirkete bağlı kayıt davranışını incele

## Satış veri modeli

- [ ] `sale.order` alan listesini çek
- [ ] `sale.order.line` alan listesini çek
- [ ] Studio `x_` alanlarını envantere al
- [ ] Personel alanını doğrula
- [ ] Müşteri alanını doğrula
- [ ] Durum alanlarını ve gerçek örneklerini çıkar
- [ ] Tarih alanlarını gerçek kayıtlarla karşılaştır
- [ ] Para birimi alanlarını doğrula

## Örnek veri doğrulama

En az şu kayıtları belirle:

- [ ] açık teklif
- [ ] onaylanmış teklif/sipariş
- [ ] iptal edilmiş teklif
- [ ] süresi dolmuş teklif
- [ ] ay sonunda oluşturulup sonraki ay onaylanan teklif
- [ ] farklı şirketten kayıt
- [ ] farklı para biriminden kayıt
- [ ] Studio özel alanı dolu kayıt

## Tutarsızlık analizi

- [ ] Daha önce farklı sonuç veren ayı seç
- [ ] Her iki rapordaki kayıt ID listelerini karşılaştır
- [ ] Farkların tarih alanından mı, durumdan mı, şirketten mi kaynaklandığını belirle
- [ ] Kanonik teklif sayımı kuralını onayla
- [ ] Beklenen KPI tablosunu manuel oluştur

## Teknik spike

- [ ] API version endpoint testi
- [ ] Model metadata testi
- [ ] Sayfalı `sale.order` okuma
- [ ] `write_date + id` cursor denemesi
- [ ] İki şirket kapsamı denemesi
- [ ] Rate/timeout davranışı
- [ ] Güvenli hata maskeleme

## M0 çıkış paketi

- [ ] `ODOO_FIELD_INVENTORY.md`
- [ ] `ODOO_COMPANY_MAPPING.md`
- [ ] `REPORT_METRIC_DICTIONARY.md`
- [ ] `M0_DATA_VALIDATION_REPORT.md`
- [ ] Fixture veri seti
- [ ] M1 implementation plan
