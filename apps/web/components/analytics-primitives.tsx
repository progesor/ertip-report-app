import type { ReactNode } from 'react';

export type AnalyticsTone = 'neutral' | 'cyan' | 'green' | 'amber' | 'red' | 'violet';

export interface AnalyticsDelta {
  readonly label: string;
  readonly direction?: 'up' | 'down' | 'flat';
}

export function AnalyticsKpiCard({
  label,
  value,
  description,
  delta,
  tone = 'neutral',
}: Readonly<{
  label: string;
  value: ReactNode;
  description?: string;
  delta?: AnalyticsDelta;
  tone?: AnalyticsTone;
}>) {
  return (
    <article className={`analytics-kpi ${tone}`}>
      <span className="analytics-kpi-label">{label}</span>
      <strong className="analytics-kpi-value">{value}</strong>
      {delta ? (
        <span className={`analytics-delta ${delta.direction ?? 'flat'}`}>
          <span aria-hidden="true">
            {delta.direction === 'up' ? '↗' : delta.direction === 'down' ? '↘' : '→'}
          </span>
          {delta.label}
        </span>
      ) : null}
      {description ? <p>{description}</p> : null}
    </article>
  );
}

export function AnalyticsPanel({
  eyebrow,
  title,
  description,
  action,
  children,
  className = '',
}: Readonly<{
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}>) {
  return (
    <section className={`analytics-panel ${className}`.trim()}>
      <header className="analytics-panel-header">
        <div>
          {eyebrow ? <span className="analytics-eyebrow">{eyebrow}</span> : null}
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div className="analytics-panel-action">{action}</div> : null}
      </header>
      <div className="analytics-panel-content">{children}</div>
    </section>
  );
}

export function AnalyticsTableFrame({
  eyebrow,
  title,
  description,
  action,
  children,
  testId,
}: Readonly<{
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  testId?: string;
}>) {
  return (
    <section className="analytics-panel analytics-table-panel" data-testid={testId}>
      <header className="analytics-panel-header">
        <div>
          {eyebrow ? <span className="analytics-eyebrow">{eyebrow}</span> : null}
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div className="analytics-panel-action">{action}</div> : null}
      </header>
      <div className="analytics-table-scroll">{children}</div>
    </section>
  );
}

export function AnalyticsBadge({
  children,
  tone = 'neutral',
}: Readonly<{ children: ReactNode; tone?: AnalyticsTone }>) {
  return <span className={`analytics-badge ${tone}`}>{children}</span>;
}

export type ReportStateVariant = 'loading' | 'empty' | 'error' | 'not-found';

export function ReportState({
  variant,
  eyebrow,
  title,
  description,
  actions,
}: Readonly<{
  variant: ReportStateVariant;
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}>) {
  return (
    <section className={`report-state ${variant}`} aria-live={variant === 'loading' ? 'polite' : undefined}>
      <div className="report-state-visual" aria-hidden="true">
        {variant === 'loading' ? <span className="report-state-spinner" /> : <span>{variant === 'error' ? '!' : variant === 'not-found' ? '404' : '—'}</span>}
      </div>
      <div>
        <span className="analytics-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        {actions ? <div className="report-state-actions">{actions}</div> : null}
      </div>
    </section>
  );
}

export function AnalyticsSkeleton({
  lines = 3,
  label = 'İçerik yükleniyor',
}: Readonly<{ lines?: number; label?: string }>) {
  return (
    <div aria-label={label} className="analytics-skeleton" role="status">
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} style={{ width: `${Math.max(44, 100 - index * 14)}%` }} />
      ))}
    </div>
  );
}
