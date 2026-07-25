'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { SaleOrderSyncRun } from '@ertip/db';

interface SyncHistoryResponse {
  readonly ok?: boolean;
  readonly error?: string;
  readonly runs?: readonly SaleOrderSyncRun[];
}

interface QueueSyncResponse {
  readonly ok?: boolean;
  readonly error?: string;
  readonly created?: boolean;
  readonly run?: SaleOrderSyncRun;
}

function formatCount(value: number | null): string {
  return value === null ? '—' : new Intl.NumberFormat('tr-TR').format(value);
}

function formatDateTime(value: Date | string | null): string {
  if (value === null) {
    return '—';
  }

  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getStatusLabel(status: SaleOrderSyncRun['status']): string {
  const labels = {
    queued: 'Sırada',
    running: 'Çalışıyor',
    succeeded: 'Başarılı',
    failed: 'Başarısız',
  } as const;
  return labels[status];
}

function getStatusTone(status: SaleOrderSyncRun['status']): string {
  if (status === 'succeeded') {
    return 'success';
  }

  if (status === 'failed') {
    return 'failure';
  }

  if (status === 'running' || status === 'queued') {
    return 'testing';
  }

  return 'idle';
}

export function SyncControlPanel({
  odooConfigured,
}: Readonly<{ odooConfigured: boolean }>) {
  const [runs, setRuns] = useState<readonly SaleOrderSyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueing, setQueueing] = useState(false);
  const [message, setMessage] = useState('Senkronizasyon geçmişi yükleniyor…');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const activeRun = useMemo(
    () => runs.find(({ status }) => status === 'queued' || status === 'running') ?? null,
    [runs],
  );
  const latestRun = runs[0] ?? null;

  const loadRuns = useCallback(async () => {
    try {
      const response = await fetch('/api/owner/sync-runs', { cache: 'no-store' });
      const payload = (await response.json()) as SyncHistoryResponse;

      if (!response.ok || !payload.ok || !payload.runs) {
        setMessage(payload.error ?? 'Senkronizasyon geçmişi okunamadı.');
        return;
      }

      setRuns(payload.runs);
      setMessage(
        payload.runs.length === 0
          ? 'Henüz senkronizasyon çalıştırılmadı.'
          : 'Worker ve PostgreSQL tabanlı kalıcı kuyruk hazır.',
      );
    } catch {
      setMessage('Senkronizasyon geçmişi için uygulama sunucusuna ulaşılamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRuns();
    const interval = window.setInterval(() => {
      void loadRuns();
    }, 5_000);
    return () => window.clearInterval(interval);
  }, [loadRuns]);

  async function queueSync(scope: 'all' | 'period') {
    setQueueing(true);
    setMessage(
      scope === 'all'
        ? 'Tam Odoo veri kapsamı sıraya alınıyor…'
        : 'Seçili dönem sıraya alınıyor…',
    );

    try {
      const response = await fetch('/api/owner/sync-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          scope === 'all' ? {} : { dateFrom: dateFrom || null, dateTo: dateTo || null },
        ),
      });
      const payload = (await response.json()) as QueueSyncResponse;

      if (!response.ok || !payload.ok || !payload.run) {
        setMessage(payload.error ?? 'Senkronizasyon işi sıraya alınamadı.');
        return;
      }

      setMessage(
        payload.created
          ? 'Senkronizasyon işi kalıcı kuyruğa eklendi; worker işleyecek.'
          : 'Zaten aktif bir senkronizasyon işi bulundu; mevcut iş gösteriliyor.',
      );
      await loadRuns();
    } catch {
      setMessage('Senkronizasyon işi sıraya alınırken sunucuya ulaşılamadı.');
    } finally {
      setQueueing(false);
    }
  }

  const bannerStatus = activeRun?.status ?? latestRun?.status ?? 'queued';
  const progressText = activeRun
    ? `${formatCount(activeRun.processedCount)} / ${formatCount(activeRun.sourceCount)} kayıt işlendi`
    : latestRun?.status === 'succeeded'
      ? `${formatCount(latestRun.processedCount)} kayıt · mutabakat ${latestRun.reconciles ? 'başarılı' : 'başarısız'}`
      : message;

  return (
    <>
      <section className={`connection-banner ${getStatusTone(bannerStatus)}`} aria-live="polite">
        <div>
          <span className="eyebrow">M2 Odoo senkronizasyon çekirdeği</span>
          <h3>Kalıcı kuyruk, worker, upsert ve mutabakat</h3>
          <p>{loading ? 'Senkronizasyon durumu yükleniyor…' : `${message} ${progressText}`}</p>
        </div>
        <button
          disabled={!odooConfigured || queueing || activeRun !== null}
          onClick={() => void queueSync('all')}
          type="button"
        >
          {queueing ? 'Sıraya Alınıyor…' : 'İlk Tam Senkronizasyonu Başlat'}
        </button>
      </section>

      <section className="panel table-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Kontrollü dönem çalıştırması</span>
            <h3>Teklif oluşturma tarihine göre yeniden senkronize et</h3>
          </div>
          <div className="actions">
            <input
              aria-label="Başlangıç tarihi"
              onChange={(event) => setDateFrom(event.target.value)}
              type="date"
              value={dateFrom}
            />
            <input
              aria-label="Bitiş tarihi hariç"
              onChange={(event) => setDateTo(event.target.value)}
              type="date"
              value={dateTo}
            />
            <button
              disabled={
                !odooConfigured ||
                queueing ||
                activeRun !== null ||
                !dateFrom ||
                !dateTo ||
                dateTo <= dateFrom
              }
              onClick={() => void queueSync('period')}
              type="button"
            >
              Dönemi Sıraya Al
            </button>
          </div>
        </div>
        <p>
          Bitiş tarihi hariçtir. Aynı dönem tekrar çalıştırıldığında kaynak ID üzerinden upsert edilir;
          başarılı tam tarama sonunda kaynakta artık bulunmayan yerel kayıtlar yalnızca seçili kapsamdan
          temizlenir.
        </p>
      </section>

      <section className="panel table-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Senkronizasyon geçmişi</span>
            <h3>Son 15 çalışma</h3>
          </div>
          <button onClick={() => void loadRuns()} type="button">
            Yenile
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Durum</th>
                <th>Kapsam</th>
                <th>Kaynak</th>
                <th>İşlenen</th>
                <th>Cursor</th>
                <th>Stale silinen</th>
                <th>Mutabakat</th>
                <th>İstek</th>
                <th>Tamamlanma</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={9}>Henüz senkronizasyon çalıştırılmadı.</td>
                </tr>
              ) : (
                runs.map((run) => (
                  <tr key={run.id}>
                    <td>{getStatusLabel(run.status)}</td>
                    <td>
                      {run.dateFrom === null || run.dateTo === null
                        ? 'Tüm veri'
                        : `${run.dateFrom} → ${run.dateTo} (hariç)`}
                    </td>
                    <td>{formatCount(run.sourceCount)}</td>
                    <td>{formatCount(run.processedCount)}</td>
                    <td>#{formatCount(run.cursorSourceId)}</td>
                    <td>{formatCount(run.deletedStaleOrders)}</td>
                    <td>
                      {run.reconciles === null
                        ? 'Bekliyor'
                        : run.reconciles
                          ? 'Tam'
                          : run.safeErrorCode ?? 'Başarısız'}
                    </td>
                    <td>{formatDateTime(run.requestedAt)}</td>
                    <td>{formatDateTime(run.completedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
