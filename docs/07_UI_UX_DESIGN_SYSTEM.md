# UI/UX Design System

## 1. Tasarım hedefi

Arayüz “kurumsal ama sıradan olmayan” bir yönetim deneyimi sunmalıdır. Gösterişli öğeler veri hiyerarşisini güçlendirmek için kullanılmalı; dekorasyon rapor okunabilirliğini bozmamalıdır.

Tasarım yönü: **Executive Intelligence**.

## 2. Görsel karakter

- Koyu grafit veya koyu lacivert ana yüzey
- Açık temada sıcak kırık beyaz ve soğuk gri yüzeyler
- Kontrollü amber/bakır vurgu
- Veri ve etkileşim için serin mavi/cyan vurgu
- Başarı için yeşil, uyarı için amber, hata için kırmızı
- İnce yüzey geçişleri ve düşük yoğunluklu gradient
- Ölçülü cam etkisi; uzun tablolar ve formlarda düz yüzey
- Yüksek kaliteli ikonografi
- Büyük ve net sayı tipografisi

## 3. Tasarım ilkeleri

1. İlk bakışta sonuç, ikinci bakışta açıklama, üçüncü adımda detay.
2. Ana KPI’lar ekranın üst kısmında görünür.
3. Renk tek başına anlam taşımaz.
4. Manager ekranında teknik terminoloji kullanılmaz.
5. Bir ekranda birincil eylem sayısı sınırlıdır.
6. Filtreler rapor sonucunu gölgelememelidir.
7. Tüm kritik görünümler baskıda yeniden düzenlenir.

## 4. Manager bilgi mimarisi

```text
Genel Bakış
Raporlar
  ├── Satış ve Teklifler
  ├── Müşteriler
  └── Operasyonel Takip
Kaydedilmiş Çıktılar
Hesabım
```

Owner için ek alan:

```text
Yönetim
  ├── Rapor Şablonları
  ├── Kullanıcılar
  ├── İş Birimleri
  ├── Odoo Bağlantısı
  ├── Senkronizasyon
  ├── Veri Kalitesi
  └── Denetim Kayıtları
```

## 5. Rapor kartı

Her rapor kartı:

- kısa ve güçlü başlık,
- tek cümle açıklama,
- rapor kategorisi,
- son veri güncellemesi,
- favori/son kullanılan işareti,
- “Raporu Aç” eylemi

içerir.

## 6. Rapor ekranı

### Başlık alanı

- rapor adı,
- kısa açıklama,
- kapsam rozeti,
- son senkronizasyon zamanı,
- PDF/Excel/Yazdır eylemleri.

### Filtre çubuğu

- hızlı ay seçici,
- özel tarih aralığı,
- genel/personel görünümü,
- iş birimi,
- personel,
- müşteri,
- gelişmiş filtre çekmecesi.

Seçili filtreler özet chip olarak görünür ve tek tıkla temizlenebilir.

### KPI alanı

- büyük değer,
- kısa etiket,
- önceki dönem değişimi, varsa,
- açıklama tooltip’i,
- drill-down davranışı.

### Grafik alanı

- aylık eğilim,
- durum dağılımı,
- personel karşılaştırması,
- müşteri yoğunluğu.

Animasyonlar 150–300 ms aralığında, ölçülü ve kapatılabilir olmalıdır.

### Tablo

- sticky header,
- kontrollü kolon yoğunluğu,
- sıralama,
- filtre sonucu toplamı,
- satır detay paneli,
- XLSX dışa aktarımı.

## 7. Boş, yükleniyor ve hata durumları

- Skeleton ekranlar gerçek yerleşimi temsil eder.
- “Veri yok” ile “senkronizasyon başarısız” birbirinden ayrılır.
- Hata mesajı teknik stack trace göstermez.
- Owner’a gerektiğinde hata kimliği sunulur.

## 8. Responsive

Birincil hedef masaüstü ve geniş tablet ekranıdır. Mobilde:

- rapor okunabilir kalmalı,
- KPI kartları yatay kaydırma yerine akışa geçmeli,
- tablolar özet kart veya kontrollü yatay kaydırma kullanmalı,
- PDF üretimi masaüstü düzeninden bağımsız olmalıdır.

## 9. Baskı tasarımı

Baskıda:

- navigasyon ve interaktif kontroller kaldırılır,
- açık zemin kullanılır,
- grafik kontrastı artırılır,
- başlık ve metadata tekrar edilir,
- personel bölümleri mantıklı sayfa kırılımlarıyla ayrılır,
- renkli ve siyah-beyaz yazıcıda anlam korunur.

## 10. Tasarım anti-pattern’leri

Kaçınılacaklar:

- her yerde neon gradient,
- aşırı glassmorphism,
- okunması güç küçük metin,
- çok sayıda birbirine rakip buton,
- yalnızca ikonla anlatılan kritik eylemler,
- rapor içinde açıklamasız teknik kodlar,
- aynı bilgiyi farklı grafiklerle tekrar etmek.
