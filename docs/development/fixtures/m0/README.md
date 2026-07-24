# M0 Golden Fixture

Bu klasör gerçek Odoo kayıtlarının sanitize edilmiş ve küçültülmüş fixture setini taşıyacaktır.

M0 canlı keşif tamamlanmadan gerçek fixture eklenmez.

Zorunlu senaryolar:

1. açık `draft`
2. açık `sent`
3. `sale`
4. `cancel`
5. süresi dolmuş draft/sent
6. ay sonunda oluşturulup sonraki ay onaylanan kayıt
7. farklı şirket
8. farklı para birimi
9. özel Studio alanı dolu kayıt
10. eksik personel veya müşteri alanı

Fixture'da secret, e-posta, telefon, adres veya gereksiz kişisel veri bulunmaz. Kimlikler kararlı takma değerlerle anonimleştirilir; beklenen KPI sonucu aynı PR içinde belgelenir.
