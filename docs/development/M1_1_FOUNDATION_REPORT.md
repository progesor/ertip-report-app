# M1.1 Foundation Report

**Tarih:** 24 Temmuz 2026

**Durum:** Uygulama ve CI doğrulaması bekliyor.

## Kapsam

Bu dilim, canlı Odoo kayıt keşfi tamamlanmadan geliştirilebilen güvenli foundation bileşenlerini kurar:

- pnpm tabanlı TypeScript monorepo
- Next.js web uygulaması
- ayrı worker başlangıç noktası ve heartbeat
- Owner / Manager rol ve izin politikası
- Odoo 19 JSON-2 salt okunur istemci
- merkezi teklif durumu ve KPI hesaplama çekirdeği
- liveness, readiness ve güvenli system status endpoint'leri
- Executive Intelligence demo dashboard
- Docker / Coolify uyumlu web image
- GitHub Actions kalite kapıları

## Güvenlik davranışı

- `ODOO_API_KEY` hiçbir dosyada bulunmaz.
- Odoo istemcisi yalnızca `fields_get`, `search`, `read`, `search_read` ve `search_count` yöntemlerine izin verir.
- Üretim varsayılanında demo dashboard açılmaz; kimlik doğrulama tamamlanana kadar güvenli kurulum ekranı gösterilir.
- Staging önizlemesi açıkça `APP_DEMO_MODE=true` ile etkinleştirilir.
- System status endpoint'i secret değeri döndürmez.

## Bilinen sınırlar

- Canlı Odoo bağlantı testi, şirket ID eşlemesi ve Studio alan keşfi runtime API key olmadan tamamlanamaz.
- PostgreSQL migration ve sunucu tarafı iptal edilebilir oturumlar M1.2 kapsamındadır.
- Dashboard M1.1'de açıkça etiketlenmiş demo veri kullanır.
- Worker henüz sync gerçekleştirmez; yalnızca ayrı process sınırını ve heartbeat sözleşmesini oluşturur.

## Kalite kapıları

Merge öncesinde aşağıdaki GitHub Actions kontrolleri zorunludur:

- format
- lint
- typecheck
- unit
- integration
- build
- browser_smoke
