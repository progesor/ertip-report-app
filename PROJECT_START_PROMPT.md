# Ertip Report App — Development Start Prompt

Ertip Report App geliştirmesine başlıyoruz.

Bu repository içindeki dokümantasyonu kanonik kaynak kabul et. Özellikle şu dosyaları önce incele:

1. `docs/00_PROJECT_CANON.md`
2. `docs/project-canon.yaml`
3. `docs/02_PRODUCT_REQUIREMENTS.md`
4. `docs/03_SYSTEM_ARCHITECTURE.md`
5. `docs/04_ODOO_INTEGRATION.md`
6. `docs/05_REPORTING_DOMAIN.md`
7. `docs/07_UI_UX_DESIGN_SYSTEM.md`
8. `docs/09_DEPLOYMENT_AND_OPERATIONS.md`
9. `docs/10_TEST_STRATEGY.md`
10. `docs/11_ROADMAP.md`
11. `docs/development/M0_DISCOVERY_CHECKLIST.md`

## Ürün özeti

- Odoo Online Custom plan verilerini kullanan özel yönetim raporlama uygulaması.
- Tek Odoo veritabanında iki şirket bulunuyor; uygulamada Yurt İçi/Yurt Dışı iş birimleri olarak eşlenecek.
- Kullanıcı rolleri yalnızca Owner ve Manager.
- Personel erişimi olmayacak.
- Manager hazır raporları tarih, personel, müşteri ve kapsam filtreleriyle çalıştıracak.
- Owner entegrasyon, rapor şablonu, kullanıcı, senkronizasyon ve veri kalitesini yönetecek.
- İlk rapor Yurt Dışı Aylık Teklif Performansı.
- Arayüz şık, profesyonel, biraz gösterişli ve kolay anlaşılır olacak.
- İlk test edilebilir sürümden itibaren GitHub → Coolify staging otomatik deploy kullanılacak.

## Dağıtım modeli

- `develop` → staging otomatik deploy
- `main` → production otomatik deploy
- `main` doğrudan push kapalı
- Merge öncesi format, lint, typecheck, unit, integration, build ve browser smoke zorunlu

## İlk görev

Kod yazmadan önce M0 Discovery kapsamını uygula:

1. Odoo sürümünü ve uygun API adaptörünü doğrula.
2. `res.company`, `sale.order`, `sale.order.line`, `res.partner`, `res.users`, `res.currency` ve Studio özel alanlarını keşfet.
3. İki şirketin ID ve iş birimi eşlemesini çıkar.
4. Teklif tarihleri ve durumlarının gerçek kayıt davranışını doğrula.
5. Daha önce tutarsız çıkan ay için kayıt bazlı karşılaştırma yöntemi tasarla.
6. Sonuçları kanonik keşif dokümanlarına yaz.

Secret değerleri hiçbir dosyaya veya çıktıya yazma. Odoo erişimi salt okunur olmalı.
