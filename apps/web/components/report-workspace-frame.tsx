import Link from 'next/link';
import type { ReactNode } from 'react';

import type { AppRole } from '@ertip/auth';

import { WorkspaceShell } from '@/components/workspace-shell';

interface ReportWorkspaceUser {
  readonly displayName: string;
  readonly email: string;
  readonly role: AppRole;
}

const dateTimeFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDateTime(value: string | null): string {
  return value ? dateTimeFormatter.format(new Date(value)) : 'Henüz yok';
}

export function ReportWorkspaceFrame({
  children,
  user,
  demoMode,
  title,
  description,
  category,
  businessUnit,
  lastSyncAt,
  generatedAt,
}: Readonly<{
  children: ReactNode;
  user: ReportWorkspaceUser;
  demoMode: boolean;
  title: string;
  description: string;
  category: string;
  businessUnit: string;
  lastSyncAt: string | null;
  generatedAt: string;
}>) {
  return (
    <WorkspaceShell
      demoMode={demoMode}
      pageDescription={description}
      pageTitle={title}
      user={user}
    >
      <nav aria-label="Rapor konumu" className="report-workspace-breadcrumb no-print">
        <Link href="/reports">Raporlar</Link>
        <span aria-hidden="true">/</span>
        <span>{category}</span>
        <span aria-hidden="true">/</span>
        <strong>{title}</strong>
      </nav>

      <section className="report-workspace-context no-print" aria-label="Rapor bağlamı">
        <div>
          <span>İş birimi</span>
          <strong>{businessUnit}</strong>
        </div>
        <div>
          <span>Veri kaynağı</span>
          <strong>{demoMode ? 'Demo veri' : 'Canlı PostgreSQL'}</strong>
        </div>
        <div>
          <span>Son senkronizasyon</span>
          <strong>{formatDateTime(lastSyncAt)}</strong>
        </div>
        <div>
          <span>Rapor zamanı</span>
          <strong>{formatDateTime(generatedAt)}</strong>
        </div>
      </section>

      <div className="workspace-report-host">{children}</div>
    </WorkspaceShell>
  );
}
