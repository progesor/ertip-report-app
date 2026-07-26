import Link from 'next/link';
import { redirect } from 'next/navigation';

import { can } from '@ertip/auth';
import type { QueryResultRow } from 'pg';

import { getReportingPool } from '@/lib/reporting';
import { getCurrentSession } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface AuditRow extends QueryResultRow {
  readonly id: string;
  readonly actor_display_name: string | null;
  readonly actor_email: string | null;
  readonly action: string;
  readonly entity_type: string | null;
  readonly entity_id: string | null;
  readonly business_unit_scope: string | null;
  readonly safe_metadata_json: Readonly<Record<string, unknown>>;
  readonly created_at: Date;
}

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  dateStyle: 'medium',
  timeStyle: 'short',
});

export default async function AuditLogsPage() {
  const user = await getCurrentSession();

  if (!user || !can(user.role, 'admin:audit')) {
    redirect('/');
  }

  const result = await getReportingPool().query<AuditRow>(
    `SELECT
       audit.id::text,
       users.display_name AS actor_display_name,
       users.email AS actor_email,
       audit.action,
       audit.entity_type,
       audit.entity_id,
       audit.business_unit_scope,
       audit.safe_metadata_json,
       audit.created_at
     FROM audit_logs AS audit
     LEFT JOIN users ON users.id = audit.actor_user_id
     ORDER BY audit.created_at DESC, audit.id DESC
     LIMIT 100`,
  );

  return (
    <main className="audit-page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Owner · Güvenli olay geçmişi</span>
          <h1>Denetim Kayıtları</h1>
        </div>
        <Link className="button" href="/">Panele dön</Link>
      </header>

      <section className="panel table-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Son 100 olay</span>
            <h3>Bağlantı, senkronizasyon ve rapor çıktıları</h3>
          </div>
          <a className="button" href="/api/owner/audit-logs">JSON</a>
        </div>
        <p>
          Metadata alanı yalnızca güvenli teknik kapsamı içerir; müşteri adı, teklif tutarı ve secret değerleri
          denetim kaydına yazılmaz.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Zaman</th>
                <th>Kullanıcı</th>
                <th>İşlem</th>
                <th>Varlık</th>
                <th>İş birimi</th>
                <th>Güvenli metadata</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.length === 0 ? (
                <tr><td colSpan={6}>Henüz denetim kaydı bulunmuyor.</td></tr>
              ) : (
                result.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{dateFormatter.format(row.created_at)}</td>
                    <td>
                      <strong>{row.actor_display_name ?? 'Sistem'}</strong>
                      <small className="table-subtitle">{row.actor_email ?? '—'}</small>
                    </td>
                    <td><code>{row.action}</code></td>
                    <td>{row.entity_type ?? '—'}{row.entity_id ? ` · ${row.entity_id}` : ''}</td>
                    <td>{row.business_unit_scope ?? '—'}</td>
                    <td><code>{JSON.stringify(row.safe_metadata_json)}</code></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
