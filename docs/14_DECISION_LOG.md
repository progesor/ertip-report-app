# Decision Log

## ADR-001 — Hazır yönetici raporları

**Karar:** Manager kullanıcıları rapor tasarlamayacak; Owner’ın yayımladığı raporları çalıştıracaktır.

**Neden:** Kullanıcı sayısı az, yöneticiler teknik değil ve yanlış rapor tanımı riski yüksek.

## ADR-002 — İki rol

**Karar:** İlk sürümde yalnızca Owner ve Manager bulunacaktır.

**Neden:** Gereksiz rol ve organizasyon karmaşıklığını önlemek.

## ADR-003 — Yerel raporlama veritabanı

**Karar:** Raporlar yalnızca anlık Odoo API sorgularına dayanmayacaktır; PostgreSQL raporlama katmanı kullanılacaktır.

**Neden:** Hız, tutarlılık, mutabakat, geçmiş izlenebilirliği ve export üretimi.

## ADR-004 — Modüler monolit

**Karar:** Web/API modüler monolit, uzun işler ayrı worker olacaktır.

**Neden:** Küçük ekip ve kullanıcı sayısında mikroservis operasyon yükünden kaçınmak.

## ADR-005 — Staging-first canlı test

**Karar:** İlk denenebilir sürümden itibaren `develop` branch’i Coolify staging ortamına otomatik deploy edilecektir.

**Neden:** Local dışındaki gerçek ağ, TLS, container ve environment koşullarında erken test.

## ADR-006 — Korumalı production

**Karar:** `main` production’a otomatik deploy olur; doğrudan push kapalı ve CI zorunludur.

**Neden:** Otomatik deploy kolaylığını production güvenliğiyle dengelemek.

## ADR-007 — Executive Intelligence UI

**Karar:** Arayüz koyu/açık tema destekli, premium yönetim dashboard karakterinde olacaktır.

**Neden:** Kullanıcının şık, profesyonel, biraz gösterişli ve anlaşılır arayüz beklentisi.

## ADR-008 — Rapor editörü ertelendi

**Karar:** Tam sürükle-bırak rapor oluşturucu ilk sürüme alınmayacaktır.

**Neden:** İlk değer, güvenilir hazır raporların yöneticiler tarafından bağımsız çalıştırılmasıdır.

## ADR-009 — Odoo salt okunur

**Karar:** İlk sürüm Odoo’ya veri yazmayacaktır.

**Neden:** Raporlama ürününün risk alanını sınırlamak ve kaynak veriyi korumak.

## ADR-010 — Odoo 19 JSON-2 adaptörü

**Karar:** Odoo 19 entegrasyonunda birincil adaptör External JSON-2 API olacaktır.

**Neden:** JSON-2 Odoo 19'da sunulan güncel dış API yüzeyidir; tenant'a özgü modeller `/doc` ve `fields_get` ile keşfedilebilir. Legacy RPC yalnızca sürüm geri dönüşü için adaptör sınırının arkasında tutulur.

## ADR-011 — Teklif kohortu için değişmez tarih

**Karar:** İlk raporda teklif üretim kohortu için başlangıç alanı `sale.order.create_date` olacaktır; `date_order` kohort alanı olarak kullanılmayacaktır. Canlı tenant'ta güvenilir özel teklif tarihi bulunursa kayıt bazlı karşılaştırma ve yeni ADR gerekir.

**Neden:** Odoo 19'da `date_order` taslak/gönderilmiş teklifte oluşturma, onaylı siparişte onay tarihi semantiği taşır. Durum değişimi aynı kaydı başka aya taşıyarak rapor tutarsızlığı üretebilir.

## ADR-012 — PostgreSQL destekli opaque oturum

**Karar:** Kimlik doğrulama oturumları tahmin edilemez bir cookie token ile kurulacak; token'ın kendisi veritabanına yazılmayacak, yalnızca `SESSION_SECRET` ile HMAC özeti saklanacaktır.

**Neden:** Oturum iptali, kullanıcı bazlı toplu çıkış, audit ve düşük kullanıcı sayısında basit operasyon sağlarken çalınmış veritabanından kullanılabilir session token çıkarılmasını önlemek.

## ADR-013 — Yerleşik memory-hard parola hashleme

**Karar:** İlk sürüm parolaları Node.js `crypto.scrypt` ile yüksek maliyet parametreleri ve kullanıcıya özgü rastgele salt kullanarak hashleyecektir.

**Neden:** Modern memory-hard parola korumasını ek native bağımlılık ve container derleme riski oluşturmadan sağlamak. Hash formatı sürümlüdür ve ileride Argon2id'e kontrollü geçişe izin verir.

## ADR-014 — Tek kullanımlık Owner bootstrap

**Karar:** İlk Owner hesabı yalnızca runtime ortamındaki geçici `OWNER_BOOTSTRAP_TOKEN` ile ve kullanıcı tablosu boşken oluşturulabilir. İlk kullanıcıdan sonra endpoint sunucu tarafında kapanır.

**Neden:** Repository'ye başlangıç parolası koymadan production kurulumunu tamamlamak ve anonim kayıt yüzeyi oluşturmamak.
