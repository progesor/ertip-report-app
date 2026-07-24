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

Önerilen başlangıç:

- `ertip-report-web`
- `ertip-report-worker`
- `ertip-report-postgres`
- `ertip-report-redis`

İsteğe bağlı sonraki servis:

- S3 uyumlu object storage veya harici storage

PostgreSQL ve Redis dış dünyaya açılmaz; yalnızca özel Coolify ağı üzerinden erişilir.

## 4. Deployment yöntemi

Tercih sırası:

1. Dockerfile + Coolify GitHub App entegrasyonu
2. GitHub branch koruması ve zorunlu CI kontrolleri
3. Merge sonrası ilgili branch için Coolify otomatik deploy

Coolify native auto deploy yeni push sonrası uygulamayı yeniden kurabilir. Production güvenliği CI geçişini merge öncesinde zorunlu kılarak sağlanır.

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

- heartbeat kaydı
- son başarılı job zamanı
- queue gecikmesi

## 6. Migration

- Migration production startup’ında kontrolsüz biçimde paralel çalışmamalıdır.
- Deploy pipeline veya tek kontrollü migration adımı kullanılmalıdır.
- Geriye uyumsuz şema değişiklikleri expand/migrate/contract yaklaşımıyla yapılmalıdır.

## 7. Secret yönetimi

- Tüm secret’lar Coolify runtime environment üzerinden verilir.
- `.env` repository’ye commit edilmez.
- `NEXT_PUBLIC_*` alanlarında hiçbir secret bulunmaz.
- Staging ve production secret’ları ayrıdır.

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

## 10. Rollback

- Önceki çalışan image/tag saklanır.
- Uygulama rollback ile database rollback birbirinden ayrılır.
- Geriye uyumsuz migration production’a tek adımda verilmez.
