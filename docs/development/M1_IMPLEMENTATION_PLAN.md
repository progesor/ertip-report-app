# M1 Implementation Plan

**Durum:** Taslak; M0 çıkış kriterlerine bağlıdır.

## 1. Başlama kapısı

M1 uygulama kodu ancak şu koşullar tamamlanınca başlar:

- Odoo 19 JSON-2 canlı bağlantı doğrulandı.
- Şirket ID eşlemesi onaylandı.
- Kritik alan ve Studio envanteri tamamlandı.
- Metrik sözlüğü Owner tarafından onaylandı.
- Tutarsız ay kayıt ID bazında mutabık hale getirildi.
- Golden fixture oluşturuldu.

## 2. M1 hedefi

`develop` branch'inden Coolify staging'e otomatik deploy edilen güvenli, test edilebilir temel sistem:

- TypeScript monorepo
- Next.js web/API
- ayrı worker
- PostgreSQL
- Redis queue
- Owner/Manager authentication ve authorization shell
- migration sistemi
- health/readiness endpoint'leri
- CI kalite kapıları
- Executive Intelligence tasarım sistemi başlangıcı

## 3. Önerilen teslim sırası

### M1.1 Repository foundation

- pnpm workspace
- strict TypeScript config
- formatter/lint/test/build komutları
- environment schema ve secret sınırları
- Docker development/staging yapısı

### M1.2 Persistence foundation

- PostgreSQL migration altyapısı
- kullanıcı, rol, oturum, business unit ve audit tabloları
- Redis bağlantısı ve worker heartbeat

### M1.3 Identity and authorization

- Owner/Manager login
- server-side session iptali
- business unit scope policy
- Owner route koruması

### M1.4 UI shell

- dark/light theme
- responsive navigation
- Manager rapor kartı boş durumu
- Owner yönetim navigasyonu
- erişilebilir focus/contrast temeli

### M1.5 CI and staging

- format
- lint
- typecheck
- unit
- integration
- build
- browser smoke
- `develop` merge sonrası Coolify staging auto deploy
- web readiness ve worker heartbeat smoke

## 4. Branch ve PR planı

- `develop`: staging kanoniği
- Her alt teslim için `feature/m1-*` branch'i
- Küçük PR'lar, test ve doküman aynı PR'da
- `main` yalnızca `develop → main` release PR ile güncellenir

## 5. M1 çıkış kriteri

Staging URL'de:

1. Owner ve Manager giriş yapabilir.
2. Roller doğru menüleri görür.
3. Manager Owner route'una erişemez.
4. Boş rapor dashboard'u düzgün açılır.
5. Database readiness ve worker heartbeat görünür.
6. Tüm zorunlu CI kontrolleri geçer.
