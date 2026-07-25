# Deployment and Operations

## 1. Ortamlar

### Staging

- Branch: `develop`
- Otomatik deploy: açık
- Amaç: ilk denenebilir sürümden itibaren canlı URL üzerinden test
- Ayrı veritabanı ve Redis
- Ayrı uygulama secret’ları
- Odoo bağlantısı mümkünse kısıtlı kapsam veya salt okunur aynı entegrasyon

### Production

- Branch: `main`
- Otomatik deploy: açık
- Doğrudan push kapalı
- Yalnızca CI kontrolleri geçen pull request merge edilir
- Production veritabanı staging ile paylaşılmaz

## 2. GitHub akışı

```text
feature/* → pull request → develop → staging deploy
                          │
                          └→ release PR → main → production deploy
```

Tek geliştirici olunsa bile branch koruması veri ve deployment hatalarını azaltır.

## 3. Coolify servisleri

Zorunlu başlangıç servisleri:

- `ertip-report-web`
- `ertip-report-worker`
- `ertip-report-postgres`
- `ertip-report-redis`

İsteğe bağlı sonraki servis:

- S3 uyumlu object storage veya harici storage

PostgreSQL ve Redis dış dünyaya açılmaz; yalnızca özel Coolify ağı üzerinden erişilir.

### Web uygulaması

- Repository: `progesor/ertip-report-app`
- Production branch: `main`
- Dockerfile: `Dockerfile`
- Public domain: `https://report.progesor.net/`
- Container port: `3000`

### Worker uygulaması

- Aynı repository ve aynı branch/commit
- Dockerfile: `Dockerfile.worker`
- Public domain: yok
- Public port: yok
- Uzun çalışan process; otomatik restart açık

Worker, web isteği içinde uzun Odoo aktarımı yapmak yerine PostgreSQL `sync_runs` kuyruğunu işler. Web ve worker aynı `DATABASE_URL` ve Odoo runtime secret’larını kullanır.

## 4. Deployment yöntemi

Tercih sırası:

1. Dockerfile + Coolify GitHub App entegrasyonu
2. GitHub branch koruması ve zorunlu CI kontrolleri
3. Merge sonrası ilgili branch için Coolify otomatik deploy

Coolify native auto deploy yeni push sonrası uygulamayı yeniden kurabilir. Production güvenliği CI geçişini merge öncesinde zorunlu kılarak sağlanır.

Web ve worker birbirinden bağımsız Coolify application olarak yapılandırılır; ancak aynı canonical commit’i deploy etmelidir. Yalnızca web’in deploy edilmesi senkronizasyon işlerinin `queued` durumda kalmasına neden olur.

## 5. Health checks

### Web

- `/api/health/live`
- `/api/health/ready`

Readiness:

- uygulama başlatılmış,
- veritabanına erişilebiliyor,
- gerekli migration mevcut.

Odoo’nun geçici erişilemez olması web readiness’i tamamen bozmak zorunda değildir; entegrasyon durumu ayrı gösterilir.

### Worker

- yapılandırılmış `worker.started` logu,
- 30 saniyelik `worker.heartbeat`,
- `worker.sync.started`,
- `worker.sync.completed`,
- `worker.sync.failed`,
- queue gecikmesi ve son başarılı job zamanı Owner sync geçmişinden izlenir.

Worker 15 dakikadan uzun süredir güncellenmeyen `running` işi aynı run ID ve cursor ile tekrar `queued` durumuna getirir.

## 6. Migration

- Migration production startup’ında PostgreSQL advisory lock ile seri hale getirilir.
- Web ve worker aynı idempotent migration fonksiyonunu çağırabilir.
- Geriye uyumsuz şema değişiklikleri expand/migrate/contract yaklaşımıyla yapılmalıdır.
- M2 sync çekirdeği database schema version `2` kullanır.

## 7. Secret yönetimi

- Tüm secret’lar Coolify runtime environment üzerinden verilir.
- `.env` repository’ye commit edilmez.
- `NEXT_PUBLIC_*` alanlarında hiçbir secret bulunmaz.
- Staging ve production secret’ları ayrıdır.
- Worker için gerekli production değişkenleri:
  - `APP_ENV=production`
  - `DATABASE_URL`
  - `DATABASE_SSL`
  - `ODOO_BASE_URL`
  - `ODOO_DATABASE`
  - `ODOO_API_KEY`
  - isteğe bağlı `ODOO_REQUEST_TIMEOUT_MS`

API key image katmanına, loga, audit metadata’ya veya browser response’una yazılmaz.

## 8. Yedekleme

- PostgreSQL otomatik günlük yedek
- Uzak hedefe şifreli kopya
- Düzenli restore testi
- Export dosyaları için saklama politikası
- Coolify platform yedeğinin uygulama veritabanı yedeği yerine geçmediği kabul edilir

## 9. Gözlemlenebilirlik

- Yapılandırılmış JSON log
- Request ID
- Sync run ID
- Report run ID
- Hata takip sistemi, sonraki aşamada
- Disk, RAM, CPU ve database kullanım alarmı

Sync logları müşteri adı, teklif adı, tutar, API key veya Authorization header içermez.

## 10. Rollback

- Önceki çalışan web ve worker image/tag’leri saklanır.
- Web ve worker aynı canonical sürüme birlikte rollback edilir.
- Uygulama rollback ile database rollback birbirinden ayrılır.
- Geriye uyumsuz migration production’a tek adımda verilmez.
- Schema version `2` genişletici olduğundan eski web image’ı yeni tabloları görmezden gelebilir; ancak worker rollback’i sırasında aktif sync run durumu kontrol edilmelidir.
