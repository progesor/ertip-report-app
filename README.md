# Ertip Report App

Odoo Online Custom verilerini güvenli, salt okunur bir entegrasyonla yerel raporlama katmanına taşıyacak özel yönetim raporlama uygulaması.

## Mevcut aşama

Bu sürüm M1 foundation dilimidir:

- Next.js tabanlı yönetim dashboard kabuğu
- Owner / Manager yetki modeli
- Odoo 19 JSON-2 salt okunur istemci
- merkezi teklif durumu ve KPI hesaplama çekirdeği
- liveness / readiness / system status endpoint'leri
- Docker ve Coolify uyumlu çalışma yapısı
- format, lint, typecheck, unit, integration, build ve browser smoke CI kapıları

Canlı Odoo API anahtarı repository'ye eklenmez. Yerel veya Coolify runtime environment içinde `ODOO_API_KEY` olarak tanımlanır.

## Gereksinimler

- Node.js 24 LTS
- pnpm 11.4+

## Yerel başlangıç

```bash
corepack enable
corepack prepare pnpm@11.4.0 --activate
cp .env.example .env.local
pnpm install
pnpm dev
```

Uygulama varsayılan olarak `http://localhost:3000` adresinde açılır.

## Kalite kontrolleri

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm unit
pnpm integration
pnpm build
pnpm browser:smoke
```

## Branch modeli

- `develop` → Coolify staging
- `main` → Coolify production
- feature branch → PR → zorunlu CI → merge

Kanonik ürün ve mimari belgeleri `docs/` klasöründedir.
