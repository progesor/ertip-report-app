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
