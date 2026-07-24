export function SetupRequired({
  appName,
  odooHost,
  odooDatabaseConfigured,
  databaseConfigured,
  databaseReachable,
  authenticationConfigured,
}: Readonly<{
  appName: string;
  odooHost: string | null;
  odooDatabaseConfigured: boolean;
  databaseConfigured: boolean;
  databaseReachable: boolean;
  authenticationConfigured: boolean;
}>) {
  return (
    <main className="setup-page">
      <section className="setup-card" aria-labelledby="setup-title">
        <div className="auth-brand">
          <div className="brand-mark setup-mark" aria-hidden="true">ER</div>
          <div><strong>{appName}</strong><span>Production setup</span></div>
        </div>
        <span className="badge subtle">Güvenli başlangıç modu</span>
        <h1 id="setup-title">Uygulama yapılandırması tamamlanmalı</h1>
        <p>
          Yönetim ekranı anonim erişime açılmadı. Eksik altyapı değerleri Coolify runtime
          ortamında tamamlandığında veritabanı şeması otomatik kurulacak ve ilk Owner ekranı
          açılacaktır.
        </p>
        <div className="setup-status-grid four-column">
          <div>
            <span>PostgreSQL</span>
            <strong>
              {!databaseConfigured
                ? 'DATABASE_URL eksik'
                : databaseReachable
                  ? 'Bağlantı hazır'
                  : 'Bağlantı kurulamadı'}
            </strong>
          </div>
          <div>
            <span>Oturum Güvenliği</span>
            <strong>{authenticationConfigured ? 'SESSION_SECRET hazır' : 'SESSION_SECRET eksik'}</strong>
          </div>
          <div>
            <span>Odoo Sunucusu</span>
            <strong>{odooHost ?? 'Tanımlanmadı'}</strong>
          </div>
          <div>
            <span>Odoo Veritabanı</span>
            <strong>{odooDatabaseConfigured ? 'Tanımlı' : 'Tanımlanmadı'}</strong>
          </div>
        </div>
        <div className="setup-warning">
          <strong>Coolify için gereken ek değerler</strong>
          <p>
            <code>DATABASE_URL</code>, <code>DATABASE_SSL=false</code> ve en az 32 karakterlik
            <code> SESSION_SECRET</code> tanımlanmalıdır.
          </p>
        </div>
        <a className="button primary setup-link" href="/api/system/status">
          Sistem durumunu görüntüle
        </a>
      </section>
    </main>
  );
}
