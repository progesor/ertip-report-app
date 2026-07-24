'use client';

import { useState, type FormEvent } from 'react';

interface ApiResult {
  readonly ok?: boolean;
  readonly error?: string;
}

export function AuthPage({
  appName,
  odooConfigured,
}: Readonly<{ appName: string; odooConfigured: boolean }>) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
        }),
      });
      const payload = (await response.json()) as ApiResult;

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? 'Giriş işlemi tamamlanamadı.');
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
      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-brand">
          <div className="brand-mark" aria-hidden="true">
            ER
          </div>
          <div>
            <strong>{appName}</strong>
            <span>Executive Intelligence</span>
          </div>
        </div>

        <span className="badge subtle">Güvenli yönetici erişimi</span>
        <h1 id="login-title">Yönetici girişi</h1>
        <p>Yayımlanmış raporlara ve yetkinize açık yönetim araçlarına erişin.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>E-posta</span>
            <input
              autoComplete="email"
              inputMode="email"
              name="email"
              placeholder="yonetici@ertipmedical.com"
              required
              type="email"
            />
          </label>
          <label>
            <span>Parola</span>
            <input
              autoComplete="current-password"
              name="password"
              placeholder="Parolanız"
              required
              type="password"
            />
          </label>

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <button className="button primary auth-submit" disabled={submitting} type="submit">
            {submitting ? 'Doğrulanıyor…' : 'Giriş Yap'}
          </button>
        </form>

        <div className="auth-status">
          <span><i className="status online" />Veritabanı hazır</span>
          <span>
            <i className={odooConfigured ? 'status online' : 'status warning'} />
            {odooConfigured ? 'Odoo secret hazır' : 'Odoo yapılandırması eksik'}
          </span>
        </div>
      </section>
    </main>
  );
}
