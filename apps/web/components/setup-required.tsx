export function SetupRequired({
  odooHost,
  databaseConfigured,
}: Readonly<{ odooHost: string | null; databaseConfigured: boolean }>) {
  return (
    <main className="setup-page">
      <section className="setup-card" aria-labelledby="setup-title">
        <div className="brand-mark setup-mark" aria-hidden="true">
          ER
        </div>
        <span className="badge subtle">Güvenli başlangıç modu</span>
        <h1 id="setup-title">Ertip Report App kurulumu hazırlanıyor</h1>
        <p>
          Üretim ortamında demo dashboard varsayılan olarak kapalıdır. Kimlik doğrulama ve
          sunucu tarafı oturum katmanı etkinleştirilene kadar yönetim verileri dışarı açılmaz.
        </p>
        <div className="setup-status-grid">
          <div>
            <span>Odoo sunucusu</span>
            <strong>{odooHost ?? 'Tanımlanmadı'}</strong>
          </div>
          <div>
            <span>Veritabanı</span>
            <strong>{databaseConfigured ? 'Tanımlı' : 'Tanımlanmadı'}</strong>
          </div>
          <div>
            <span>API anahtarı</span>
            <strong>Yalnızca runtime secret</strong>
          </div>
        </div>
        <p className="setup-note">
          Staging önizlemesi için Coolify ortamında <code>APP_DEMO_MODE=true</code> kullanılabilir.
        </p>
        <a className="button primary setup-link" href="/api/system/status">
          Sistem durumunu görüntüle
        </a>
      </section>
    </main>
  );
}
