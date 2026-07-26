'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import type { AppRole } from '@ertip/auth';

interface WorkspaceUser {
  readonly displayName: string;
  readonly email: string;
  readonly role: AppRole;
}

interface NavigationItem {
  readonly label: string;
  readonly href: string;
  readonly icon: string;
}

const primaryNavigation: readonly NavigationItem[] = [
  { label: 'Genel Bakış', href: '/', icon: '01' },
  { label: 'Raporlar', href: '/reports', icon: '02' },
] as const;

const ownerNavigation: readonly NavigationItem[] = [
  { label: 'Denetim Kayıtları', href: '/owner/audit-logs', icon: 'A1' },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceShell({
  children,
  user,
  demoMode,
  pageTitle,
  pageDescription,
}: Readonly<{
  children: ReactNode;
  user: WorkspaceUser;
  demoMode: boolean;
  pageTitle: string;
  pageDescription?: string;
}>) {
  const pathname = usePathname();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/');
  }

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link aria-label="Ertip Report ana sayfa" className="workspace-brand" href="/">
          <span className="workspace-brand-mark">ER</span>
          <span>
            <strong>Ertip Report</strong>
            <small>Executive Intelligence</small>
          </span>
        </Link>

        <nav aria-label="Ana navigasyon" className="workspace-navigation">
          <span className="workspace-nav-label">Çalışma Alanı</span>
          {primaryNavigation.map((item) => (
            <Link
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
              className={isActive(pathname, item.href) ? 'workspace-nav-item active' : 'workspace-nav-item'}
              href={item.href}
              key={item.href}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </Link>
          ))}

          {user.role === 'owner' ? (
            <>
              <span className="workspace-nav-label owner">Yönetim</span>
              {ownerNavigation.map((item) => (
                <Link
                  aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                  className={isActive(pathname, item.href) ? 'workspace-nav-item active' : 'workspace-nav-item'}
                  href={item.href}
                  key={item.href}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </>
          ) : null}
        </nav>

        <div className="workspace-sidebar-status">
          <span className="status online" />
          <div>
            <strong>{demoMode ? 'Demo çalışma alanı' : 'Canlı çalışma alanı'}</strong>
            <small>{user.role === 'owner' ? 'Owner görünümü' : 'Manager görünümü'}</small>
          </div>
        </div>
      </aside>

      <main className="workspace-main">
        <header className="workspace-topbar">
          <div>
            <span className="workspace-kicker">Ertip yönetim raporları</span>
            <h1>{pageTitle}</h1>
            {pageDescription ? <p>{pageDescription}</p> : null}
          </div>
          <div className="workspace-user">
            <div>
              <strong>{user.displayName}</strong>
              <span>{user.role === 'owner' ? 'Owner' : 'Manager'} · {user.email}</span>
            </div>
            {demoMode ? (
              <span className="workspace-demo-badge">Demo</span>
            ) : (
              <button onClick={handleLogout} type="button">Çıkış</button>
            )}
          </div>
        </header>
        <div className="workspace-content">{children}</div>
      </main>
    </div>
  );
}
