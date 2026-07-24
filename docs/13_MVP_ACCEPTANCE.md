# MVP Acceptance Criteria

MVP, M4 sonunda aşağıdaki koşullar sağlandığında kabul edilir.

## Platform

- [ ] Staging ve production ortamları ayrıdır.
- [ ] `develop` staging’e otomatik deploy olur.
- [ ] `main` production’a otomatik deploy olur.
- [ ] CI başarısızken korumalı branch’e merge edilemez.
- [ ] Health checks çalışır.
- [ ] Database yedeği ve restore prosedürü doğrulanmıştır.

## Güvenlik

- [ ] Owner ve Manager rolleri vardır.
- [ ] Manager Owner ekranlarına erişemez.
- [ ] İş birimi kapsamı sunucu tarafında zorlanır.
- [ ] Odoo API key frontend veya logda görünmez.
- [ ] Odoo entegrasyonu salt okunurdur.

## Odoo ve veri

- [ ] Odoo sürümü ve API adaptörü doğrulanmıştır.
- [ ] İki Odoo şirketi iş birimlerine eşlenmiştir.
- [ ] Artımlı senkronizasyon idempotent çalışır.
- [ ] Son senkronizasyon bilgisi görünür.
- [ ] Veri kalitesi sorunları Owner’a gösterilir.

## İlk rapor

- [ ] Ay ve özel tarih aralığı seçilebilir.
- [ ] Genel görünüm vardır.
- [ ] Personel görünümü vardır.
- [ ] Müşteri görünümü vardır.
- [ ] Toplam, gerçekleşen, açık, gerçekleşmeyen ve dönüşüm KPI’ları doğrudur.
- [ ] Açık teklifler gerçekleşmedi sayılmaz.
- [ ] Kullanılan tarih ekseni raporda görünür.
- [ ] Detay teklif listesi açılabilir.
- [ ] Tüm ekranlar aynı metric service sonucunu kullanır.

## Çıktı

- [ ] Tarayıcı yazdırma görünümü temizdir.
- [ ] Seçili personel PDF’i oluşturulur.
- [ ] Tüm personeller PDF’inde her personelin grafik ve detay bölümü vardır.
- [ ] XLSX özet ve detay sayfalarını içerir.
- [ ] Türkçe karakterler doğru görünür.

## Kullanılabilirlik

- [ ] Manager teknik yardım almadan rapor çalıştırabilir.
- [ ] Ana ekran şık, profesyonel ve kolay anlaşılırdır.
- [ ] Yükleniyor, boş ve hata durumları ayrıdır.
- [ ] Masaüstü ve tablet görünümü kullanılabilirdir.
