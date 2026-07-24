# Ertip Report App

Odoo Online Custom verilerini güvenli, salt okunur bir entegrasyonla yerel raporlama katmanına taşıyan özel yönetim raporlama uygulaması.

## Mevcut aşama

Bu sürüm M1 production foundation dilimidir:

- Next.js tabanlı yönetim dashboard kabuğu
- PostgreSQL şeması ve idempotent migration
- veritabanı destekli Owner / Manager oturumları
- tek kullanımlık ilk Owner kurulumu
- güvenli parola hashleme, HttpOnly cookie, login lockout ve audit
- Owner-only canlı Odoo bağlantı testi
- Odoo 19 JSON-2 salt okunur istemci
- merkezi teklif durumu ve KPI hesaplama çekirdeği
- liveness / readiness / system status endpoint'leri
- Docker ve Coolify uyumlu çalışma yapısı
- format, lint, typecheck, unit, PostgreSQL integration, Docker build ve Chromium smoke CI kapıları

Canlı Odoo API anahtarı, veritabanı bağlantısı ve oturum secret değerleri repository'ye eklenmez. Yalnızca yerel veya Coolify runtime environment içinde tanımlanır.

## Gereksinimler

- Node.js 24 LTS
- pnpm 11.4+
- PostgreSQL 17+

## Yerel başlangıç

```bash
corepack enable
corepack prepare pnpm@11.4.0 --activate
cp .env.example .env.local
pnpm install
pnpm db:migrate
pnpm dev
```

Uygulama varsayılan olarak `http://localhost:3000` adresinde açılır.

## Production ortam değişkenleri

```env
APP_ENV=production
APP_DEMO_MODE=false
DATABASE_URL=postgresql://...
DATABASE_SSL=false
SESSION_SECRET=<en-az-32-karakter-rastgele-deger>
SESSION_TTL_HOURS=12
OWNER_BOOTSTRAP_TOKEN=<en-az-24-karakter-gecici-deger>
ODOO_BASE_URL=https://ertipmedical.odoo.com
ODOO_DATABASE=ertipmedical
ODOO_API_KEY=<runtime-secret>
```

İlk deployment sonrası uygulama ilk Owner hesabı ekranını gösterir. Hesap oluşturulduktan sonra `OWNER_BOOTSTRAP_TOKEN` Coolify ortamından kaldırılmalı ve uygulama yeniden deploy edilmelidir. Kullanıcı bulunduğu sürece bootstrap endpoint'i ayrıca sunucu tarafında kapalıdır.

## Kalite kontrolleri

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm unit
pnpm integration
pnpm build
pnpm browser:smoke
pnpm browser:auth
```

## Branch modeli

- `develop` → Coolify staging
- `main` → Coolify production
- feature branch → PR → zorunlu CI → merge

Kanonik ürün ve mimari belgeleri `docs/` klasöründedir.
