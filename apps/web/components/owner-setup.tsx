'use client';

import { useState, type FormEvent } from 'react';

interface ApiResult {
  readonly ok?: boolean;
  readonly error?: string;
  readonly details?: readonly string[];
}

export function OwnerSetup({
  appName,
  bootstrapConfigured,
  odooHost,
}: Readonly<{
  appName: string;
  bootstrapConfigured: boolean;
  odooHost: string | null;
}>) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/auth/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: form.get('displayName'),
          email: form.get('email'),
          password: form.get('password'),
          bootstrapToken: form.get('bootstrapToken'),
        }),
      });
      const payload = (await response.json()) as ApiResult;

      if (!response.ok || !payload.ok) {
        setError(payload.details?.[0] ?? payload.error ?? 'Owner hesabı oluşturulamadı.');
        return;
      }

      window.location.assign('/');
    } catch {
      setError('Sunucuya ulaşılamadı. Lütfen tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card setup-owner-card" aria-labelledby="owner-setup-title">
        <div className="auth-brand">
          <div className="brand-mark" aria-hidden="true">ER</div>
          <div><strong>{appName}</strong><span>İlk güvenli kurulum</span></div>
        </div>

        <span className="badge subtle">Yalnızca bir kez çalışır</span>
        <h1 id="owner-setup-title">İlk Owner hesabını oluşturun</h1>
        <p>
          Bu hesap tüm raporlara ve yönetim ayarlarına erişir. İlk Owner oluşturulduktan sonra
          bootstrap endpoint’i otomatik olarak kapanır.
        </p>

        {!bootstrapConfigured ? (
          <div className="setup-warning" role="alert">
            <strong>OWNER_BOOTSTRAP_TOKEN eksik</strong>
            <p>
              Coolify ortamına en az 24 karakterlik rastgele bir değer ekleyip uygulamayı yeniden
              deploy edin.
            </p>
          </div>
        ) : (
          <form className="auth-form owner-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <label>
                <span>Ad Soyad</span>
                <input autoComplete="name" name="displayName" required type="text" />
              </label>
              <label>
                <span>E-posta</span>
                <input autoComplete="email" inputMode="email" name="email" required type="email" />
              </label>
            </div>
            <label>
              <span>Parola</span>
              <input autoComplete="new-password" name="password" required type="password" />
              <small>En az 12 karakter; büyük harf, küçük harf ve rakam.</small>
            </label>
            <label>
              <span>Owner Bootstrap Token</span>
              <input autoComplete="off" name="bootstrapToken" required type="password" />
              <small>Coolify’da tanımladığınız geçici kurulum anahtarı.</small>
            </label>

            {error ? <p className="form-error" role="alert">{error}</p> : null}

            <button className="button primary auth-submit" disabled={submitting} type="submit">
              {submitting ? 'Hesap oluşturuluyor…' : 'Owner Hesabını Oluştur'}
            </button>
          </form>
        )}

        <div className="auth-status">
          <span><i className="status online" />PostgreSQL şeması hazır</span>
          <span><i className="status online" />Odoo: {odooHost ?? 'runtime secret'}</span>
        </div>
      </section>
    </main>
  );
}
