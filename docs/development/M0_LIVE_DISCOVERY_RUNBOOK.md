# M0 Live Discovery Runbook

Bu runbook, Ertip Odoo Online ortamında yalnızca salt okunur keşif yapmak için kullanılır. Uygulama kodu başlamadan önce tamamlanmalıdır.

## 1. Gerekli runtime metadata

Değerler repository'ye veya çıktılara yazılmaz:

- `ODOO_BASE_URL`
- `ODOO_DATABASE`, domain tek veritabanını kesin belirlemiyorsa
- `ODOO_API_KEY`
- isteğe bağlı bağlantı etiketi ve entegrasyon kullanıcı görünen adı

Secret yalnızca geçici güvenli runtime environment içinde bulunur. Komut geçmişi, ekran görüntüsü, log ve fixture'a yazılmaz.

## 2. Güvenlik ön koşulu

- Ayrı entegrasyon kullanıcısı tercih edilir.
- Kullanıcı iki gerekli şirkete erişebilir olmalıdır.
- Satış, partner, kullanıcı ve para birimi modellerinde okuma izni bulunmalıdır.
- Oluşturma, düzenleme, silme ve iş eylemleri yetki testinde başarısız olmalıdır.
- İstemci tarafında yalnızca okuma yöntemlerinden oluşan allowlist uygulanır.

## 3. Bağlantı ve sürüm doğrulama

1. Base URL normalize edilir; path sonunda gereksiz slash tutulmaz.
2. Odoo version info endpoint'iyle ana/minor sürüm kaydedilir.
3. `/json/2` erişimi ve `/doc` dinamik dokümantasyonu kontrol edilir.
4. `res.company/search_count` veya eşdeğer zararsız okuma isteğiyle API key doğrulanır.
5. Hata çıktısında Authorization header ve database değeri maskelenir.

Beklenen adaptör: Odoo 19 External JSON-2.

## 4. Metadata keşif sırası

Her hedef model için önce `fields_get`, sonra sınırlı `search_read` yapılır:

1. `res.company`
2. `res.currency`
3. `res.users`
4. `res.partner`
5. `sale.order`
6. `sale.order.line`
7. Yetki varsa `ir.model` ve `ir.model.fields`

`fields_get` metadata'sından en az şu özellikler saklanır:

- string
- type
- relation
- required
- readonly
- store
- selection
- company_dependent, varsa

## 5. Şirket keşfi

`res.company` kayıtları `id asc` sırasıyla okunur. Sonuç yalnızca güvenli keşif belgesine şu alanlarla işlenir:

- id
- name
- active
- parent_id
- currency_id

API key, kullanıcı login'i veya tam ham response saklanmaz.

Owner eşlemesi tamamlanmadan Yurt İçi/Yurt Dışı tahmini yapılmaz.

## 6. Satış örnekleme

Aşağıdaki kayıt sınıflarından en az birer örnek ID seçilir:

- draft açık teklif
- sent açık teklif
- sale siparişe dönüşmüş teklif
- cancel iptal
- validity_date geçmiş draft/sent
- ay sonunda oluşturulup sonraki ay sale olmuş kayıt
- diğer şirket kaydı
- farklı currency_id kaydı
- özel `x_` alanı dolu kayıt

Örnekler kişisel gereksiz alanlar olmadan fixture'a anonimleştirilir.

## 7. Tarih davranışı testi

Aynı kayıtta aşağıdaki alanlar karşılaştırılır:

- `create_date`
- `date_order`
- `validity_date`
- `write_date`
- varsa özel teklif/sonuç tarihi

Özellikle teklifken oluşturulmuş ve daha sonra onaylanmış bir kayıtta `create_date` ile `date_order` ayları farklıysa kayıt altına alınır.

## 8. Sayfalama ve cursor testi

- Kararlı sıra: `write_date asc, id asc`.
- Cursor: `(last_write_date, last_id)`.
- Aynı `write_date` değerindeki kayıtlar ID ile ayrılır.
- Bir sonraki sync'te küçük örtüşmeli pencere uygulanır ve upsert idempotentliği kontrol edilir.
- İlk discovery sorguları küçük limitlerle çalıştırılır; rate/timeout davranışı ölçülür.

## 9. Salt okunur negatif test

Production verisine dokunmadan, entegrasyon kullanıcısının yazma yetkisinin bulunmadığı yönetim ekranından/ACL incelemesinden doğrulanması tercih edilir. API üzerinden gerçek `write` denemesi yapılmaz.

Yazma erişimi varsa M0 güvenlik kriteri başarısız sayılır ve kullanıcı yetkileri daraltılmadan devam edilmez.

## 10. Çıktı sanitizasyonu

- API key hiçbir dosyada bulunmaz.
- Authorization header kaydedilmez.
- Tam müşteri iletişim bilgileri fixture'a alınmaz.
- Gerçek adlar fixture'da kararlı takma kimliklerle değiştirilir.
- Kaynak `sale.order.id` değerleri mutabakat belgesinde tutulabilir; dışarı paylaşılmaz.
- Ham response yalnızca geçici şifreli çalışma alanında tutulur ve M0 sonunda silinir.
