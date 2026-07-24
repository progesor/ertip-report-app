# Security and Access

## 1. Tehdit modeli özeti

Korunacak ana varlıklar:

- Odoo API anahtarı
- yönetim raporları
- müşteri ve satış bilgileri
- kullanıcı hesapları
- export dosyaları
- iş birimi erişim sınırları

## 2. Rol modeli

### Owner

- tüm raporları görür,
- tüm iş birimlerini görür,
- kullanıcı ve bağlantı yönetir,
- rapor yayımlar,
- veri kalitesi ve audit kayıtlarını görür.

### Manager

- yalnızca yayımlanmış raporları görür,
- yalnızca atanmış iş birimlerini görür,
- rapor tanımını değiştiremez,
- yönetim ayarlarına erişemez.

## 3. Sunucu tarafı zorunluluğu

- Rol ve kapsam kontrolü yalnızca UI gizlemesine dayanmaz.
- Her API route ve rapor sorgusu authorization policy’den geçer.
- İş birimi filtreleri kullanıcı isteğinden bağımsız biçimde sunucu tarafından eklenir.

## 4. Odoo güvenliği

- Ayrı entegrasyon kullanıcısı
- Salt okunur yetki
- Yalnızca gereken şirket ve modeller
- API key’in runtime secret olarak tutulması
- Secret’ın frontend bundle’a girmemesi
- Loglarda header ve key maskeleme
- Periyodik anahtar rotasyonu

## 5. Kimlik doğrulama

- Parolalar Argon2id veya eşdeğer modern yöntemle hashlenir.
- Güvenli, HttpOnly, SameSite cookie tabanlı oturum önerilir.
- CSRF korunumu state-changing işlemlerde uygulanır.
- Login rate limit ve geçici lockout bulunur.
- Owner oturumları gerektiğinde topluca iptal edebilir.

## 6. Export güvenliği

- Export dosyaları tahmin edilemez anahtarla saklanır.
- Erişim uygulama yetkilendirmesinden geçer.
- İmzalı ve süreli indirme URL’i kullanılabilir.
- Eski exportlar saklama politikasına göre temizlenir.

## 7. Web güvenliği

- TLS zorunlu
- Güvenli response header’ları
- CSP
- X-Frame-Options veya frame-ancestors
- HSTS production’da
- Girdi doğrulama
- Parametreli SQL
- Dosya adı ve içerik temizleme
- Bağımlılık taraması

## 8. Audit

Kaydedilecek kritik işlemler:

- giriş ve başarısız giriş,
- kullanıcı oluşturma/pasifleştirme,
- rol ve kapsam değişikliği,
- Odoo bağlantı ayarı değişikliği,
- rapor yayınlama/arşivleme,
- manuel senkronizasyon,
- export üretimi.

Audit kaydı silinemez veya normal kullanıcı tarafından değiştirilemez olmalıdır.
