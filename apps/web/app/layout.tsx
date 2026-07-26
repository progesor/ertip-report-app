import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';
import './m3.css';
import './m5-5.css';
import './m5-5-report-shell.css';

export const metadata: Metadata = {
  title: 'Ertip Report App',
  description: 'Odoo verileri için güvenilir yönetim raporlama merkezi.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
