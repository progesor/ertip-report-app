# Ertip Report App

Ertip Report App, Odoo ERP verilerini güvenli biçimde okuyarak yöneticilere hazırlanmış, kolay anlaşılır ve yazdırılabilir raporlar sunan özel bir web uygulamasıdır.

Bu paket, geliştirme başlamadan önce ürün kapsamını, mimari kararları, Odoo entegrasyonunu, raporlama kurallarını, arayüz standardını, güvenliği, Coolify dağıtımını ve test stratejisini sabitlemek için hazırlanmıştır.

## Temel ürün tanımı

- Kullanıcı kitlesi: az sayıda Owner ve Manager.
- Personel erişimi: yok.
- Manager: yalnızca yayımlanmış raporları çalıştırır, filtreler, görüntüler ve dışa aktarır.
- Owner: bağlantıları, şirket eşlemelerini, rapor şablonlarını, veri kalitesini ve kullanıcıları yönetir.
- Veri kaynağı: Odoo Online Custom plan üzerindeki tek veritabanı ve iki şirket.
- Dağıtım: GitHub tabanlı CI ve Coolify otomatik deploy.
- İlk odak: Yurt Dışı Aylık Teklif Performansı.

## Doküman sırası

1. `docs/00_PROJECT_CANON.md`
2. `docs/project-canon.yaml`
3. `docs/01_PRODUCT_VISION.md`
4. `docs/02_PRODUCT_REQUIREMENTS.md`
5. `docs/03_SYSTEM_ARCHITECTURE.md`
6. `docs/04_ODOO_INTEGRATION.md`
7. `docs/05_REPORTING_DOMAIN.md`
8. `docs/06_DATA_MODEL.md`
9. `docs/07_UI_UX_DESIGN_SYSTEM.md`
10. `docs/08_SECURITY_AND_ACCESS.md`
11. `docs/09_DEPLOYMENT_AND_OPERATIONS.md`
12. `docs/10_TEST_STRATEGY.md`
13. `docs/11_ROADMAP.md`
14. `docs/12_DEVELOPMENT_WORKFLOW.md`
15. `docs/13_MVP_ACCEPTANCE.md`
16. `docs/14_DECISION_LOG.md`
17. `docs/development/M0_DISCOVERY_CHECKLIST.md`

## Kanonik kural

Kod ile dokümantasyon çelişirse sorun çözülene kadar `00_PROJECT_CANON.md`, `project-canon.yaml` ve onaylanmış karar kayıtları ürün niyetinin kanonik kaynağıdır. Uygulama davranışına ilişkin değişikliklerde ilgili doküman ve testler aynı pull request içinde güncellenmelidir.
