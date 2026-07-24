# Development Workflow

## 1. Branch modeli

- `main`: production kanoniği
- `develop`: staging kanoniği
- `feature/<scope>`: özellik
- `fix/<scope>`: hata düzeltme
- `chore/<scope>`: bakım

## 2. Değişiklik akışı

1. Issue veya kısa görev tanımı oluştur.
2. `develop` üzerinden branch aç.
3. Küçük ve odaklı commitler yap.
4. Test ve dokümanları aynı branch’te güncelle.
5. Pull request aç.
6. CI kontrollerini geçir.
7. `develop` merge sonrası staging’i doğrula.
8. Sürüm adayı için `develop → main` pull request aç.
9. `main` merge sonrası production otomatik deploy edilir.

## 3. Commit standardı

Conventional Commits önerilir:

- `feat(reporting): add monthly quotation KPI`
- `fix(sync): preserve records sharing write_date`
- `docs(canon): clarify quotation cohort date`
- `chore(ci): add browser smoke gate`

## 4. Pull request gereksinimleri

- Amaç ve kapsam
- Kullanıcı etkisi
- Veri/migration etkisi
- Güvenlik etkisi
- Test kanıtı
- Ekran görüntüsü, UI değişikliği varsa
- Staging doğrulama adımları

## 5. Definition of Done

Bir iş tamamlanmış sayılmaz, eğer:

- testleri yoksa,
- hata ve boş durumları ele alınmadıysa,
- authorization kontrolü yoksa,
- dokümanla çelişiyorsa,
- staging’de doğrulanmadıysa,
- migration ve rollback etkisi incelenmediyse.

## 6. Sürümleme

SemVer kullanılır. İlk aşama:

- `0.1.0`: foundation
- `0.2.0`: Odoo sync
- `0.3.0`: ilk rapor
- `0.4.0`: export ve production readiness
- `1.0.0`: güvenilir ilk operasyonel sürüm

## 7. Kanonik değişiklikler

Rapor anlamını değiştiren her karar:

- `00_PROJECT_CANON.md`,
- `project-canon.yaml`,
- `14_DECISION_LOG.md`,
- ilgili test fixture’ları

ile güncellenir.
