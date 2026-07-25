'use client';

import { useState } from 'react';

import type { TenantDiscoveryResult } from '@ertip/odoo-client';

interface TenantDiscoveryResponse {
  readonly ok?: boolean;
  readonly error?: string;
  readonly code?: string;
  readonly durationMs?: number;
  readonly result?: TenantDiscoveryResult;
}

type DiscoveryStatus = 'idle' | 'running' | 'success' | 'failure';

interface DiscoveryViewState {
  readonly status: DiscoveryStatus;
  readonly message: string;
  readonly result: TenantDiscoveryResult | null;
  readonly durationMs: number | null;
}

function formatCount(value: number | null): string {
  return value === null ? 'Okunamadı' : new Intl.NumberFormat('tr-TR').format(value);
}

function formatBoolean(value: boolean | null): string {
  if (value === null) {
    return 'Bilinmiyor';
  }

  return value ? 'Evet' : 'Hayır';
}

function formatDiscoveryDate(value: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value));
}

function getModelLabel(model: string): string {
  const labels: Readonly<Record<string, string>> = {
    'res.company': 'Şirketler',
    'res.users': 'Kullanıcılar',
    'res.partner': 'Müşteriler / Partnerler',
    'res.currency': 'Para Birimleri',
    'sale.order': 'Teklifler / Satış Siparişleri',
  };

  return labels[model] ?? model;
}

export function TenantDiscoveryPanel({
  odooConfigured,
}: Readonly<{ odooConfigured: boolean }>) {
  const [viewState, setViewState] = useState<DiscoveryViewState>({
    status: 'idle',
    message: 'Canlı tenant keşfi henüz çalıştırılmadı.',
    result: null,
    durationMs: null,
  });

  async function handleDiscovery() {
    setViewState({
      status: 'running',
      message: 'Şirketler, alanlar ve veri kalitesi salt okunur olarak inceleniyor…',
      result: null,
      durationMs: null,
    });

    try {
      const response = await fetch('/api/owner/odoo/discovery', { method: 'POST' });
      const payload = (await response.json()) as TenantDiscoveryResponse;

      if (!response.ok || !payload.ok || !payload.result) {
        setViewState({
          status: 'failure',
          message: payload.code
            ? `${payload.error ?? 'Tenant keşfi başarısız.'} (${payload.code})`
            : payload.error ?? 'Tenant keşfi başarısız.',
          result: null,
          durationMs: payload.durationMs ?? null,
        });
        return;
      }

      setViewState({
        status: 'success',
        message: `${payload.result.serverVersion} tenant keşfi tamamlandı.`,
        result: payload.result,
        durationMs: payload.durationMs ?? null,
      });
    } catch {
      setViewState({
        status: 'failure',
        message: 'Tenant keşfi sırasında uygulama sunucusuna ulaşılamadı.',
        result: null,
        durationMs: null,
      });
    }
  }

  const result = viewState.result;
  const saleOrderModel = result?.models.find(({ model }) => model === 'sale.order') ?? null;

  return (
    <>
      <section className={`connection-banner ${viewState.status}`} aria-live="polite">
        <div>
          <span className="eyebrow">M2 canlı tenant keşfi</span>
          <h3>Şirket, alan ve veri kalite doğrulaması</h3>
          <p>{viewState.message}</p>
        </div>
        <button
          disabled={!odooConfigured || viewState.status === 'running'}
          onClick={handleDiscovery}
          type="button"
        >
          {viewState.status === 'running' ? 'Keşfediliyor…' : 'Tenant Keşfini Çalıştır'}
        </button>
      </section>

      {result ? (
        <>
          <section className="panel table-panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">Canlı tenant özeti</span>
                <h3>Odoo {result.serverVersion}</h3>
              </div>
              <div className="badges">
                <span>{result.companies.length} erişilebilir şirket</span>
                <span>{result.multiCompanyReadable ? 'Multi-company açık' : 'Tek şirket kapsamı'}</span>
                <span>{formatCount(result.saleOrder.totalCount)} sale.order</span>
                {viewState.durationMs === null ? null : <span>{viewState.durationMs} ms</span>}
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Şirket ID</th>
                    <th>Odoo şirket adı</th>
                    <th>Para birimi</th>
                    <th>Üst şirket</th>
                    <th>Aktif</th>
                    <th>İş birimi eşlemesi</th>
                  </tr>
                </thead>
                <tbody>
                  {result.companies.map((company) => (
                    <tr key={company.id}>
                      <td>{company.id}</td>
                      <td>{company.name}</td>
                      <td>
                        {company.currencyName ?? 'Bilinmiyor'}
                        {company.currencyId === null ? '' : ` (#${company.currencyId})`}
                      </td>
                      <td>{company.parentName ?? '—'}</td>
                      <td>{formatBoolean(company.active)}</td>
                      <td>Owner tarafından sabit ID ile eşlenecek</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel table-panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">Entegrasyon kullanıcı adayları</span>
                <h3>Multi-company kullanıcı kapsamı</h3>
              </div>
              <div className="badges">
                <span>{result.integrationUserCandidates.length} görünür kullanıcı</span>
                <span>Login maskeli</span>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Kullanıcı ID</th>
                    <th>Ad</th>
                    <th>Maskeli login</th>
                    <th>Varsayılan şirket</th>
                    <th>İzinli şirket ID’leri</th>
                    <th>Tüm erişilebilir şirketleri kapsıyor</th>
                  </tr>
                </thead>
                <tbody>
                  {result.integrationUserCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={6}>res.users kapsamı okunamadı veya görünür kullanıcı bulunamadı.</td>
                    </tr>
                  ) : (
                    result.integrationUserCandidates.map((candidate) => (
                      <tr key={candidate.id}>
                        <td>{candidate.id}</td>
                        <td>{candidate.name}</td>
                        <td>{candidate.maskedLogin ?? '—'}</td>
                        <td>{candidate.companyId === null ? '—' : candidate.companyId}</td>
                        <td>{candidate.companyIds.length === 0 ? '—' : candidate.companyIds.join(', ')}</td>
                        <td>{candidate.coversAccessibleCompanies ? 'Evet' : 'Hayır'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel table-panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">fields_get envanteri</span>
                <h3>Kritik model erişimi ve alan kapsamı</h3>
              </div>
              <span className="badge subtle">{formatDiscoveryDate(result.generatedAt)}</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Erişim</th>
                    <th>Toplam alan</th>
                    <th>Studio / özel alan</th>
                    <th>Eksik hedef alanlar</th>
                  </tr>
                </thead>
                <tbody>
                  {result.models.map((model) => (
                    <tr key={model.model}>
                      <td>
                        <strong>{model.model}</strong>
                        <br />
                        {getModelLabel(model.model)}
                      </td>
                      <td>{model.available ? 'Erişilebilir' : model.errorCode ?? 'Okunamadı'}</td>
                      <td>{formatCount(model.totalFieldCount)}</td>
                      <td>{formatCount(model.customFieldCount)}</td>
                      <td>
                        {model.missingTargetFields.length === 0
                          ? 'Yok'
                          : model.missingTargetFields.join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel table-panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">sale.order alan eşleme raporu</span>
                <h3>Teklif raporu için keşfedilen alanlar</h3>
              </div>
              <div className="badges">
                <span>{saleOrderModel?.customFieldCount ?? 0} özel alan</span>
                <span>Ham kayıt içeriği saklanmaz</span>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Alan</th>
                    <th>Odoo etiketi</th>
                    <th>Tip</th>
                    <th>İlişkili model</th>
                    <th>Zorunlu</th>
                    <th>Salt okunur</th>
                    <th>Kaynak</th>
                    <th>Seçenekler</th>
                  </tr>
                </thead>
                <tbody>
                  {(saleOrderModel?.fields ?? []).map((field) => (
                    <tr key={field.name}>
                      <td>{field.name}</td>
                      <td>{field.label}</td>
                      <td>{field.type}</td>
                      <td>{field.relation ?? '—'}</td>
                      <td>{field.required ? 'Evet' : 'Hayır'}</td>
                      <td>{field.readonly ? 'Evet' : 'Hayır'}</td>
                      <td>{field.name.startsWith('x_') ? 'Studio / Özel' : 'Standart'}</td>
                      <td>
                        {field.selection.length === 0
                          ? '—'
                          : field.selection.map(({ value, label }) => `${value}: ${label}`).join(' · ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section
            className={`connection-banner ${
              result.saleOrder.dateSemantics.recommendedCohortField === 'create_date'
                ? 'success'
                : 'testing'
            }`}
          >
            <div>
              <span className="eyebrow">Teklif tarih semantiği</span>
              <h3>
                {result.saleOrder.dateSemantics.recommendedCohortField === 'create_date'
                  ? 'Teklif cohort alanı: create_date'
                  : 'Tarih alanı için ek canlı doğrulama gerekli'}
              </h3>
              <p>
                {result.saleOrder.dateSemantics.confirmedSampleCount} onaylı kayıt örneğinin{' '}
                {result.saleOrder.dateSemantics.confirmedDateOrderAfterCreateCount} tanesinde date_order,
                create_date sonrasına taşınmış;{' '}
                {result.saleOrder.dateSemantics.confirmedCrossMonthCount} kayıt ay sınırını geçmiş.
                Maksimum gözlenen fark:{' '}
                {result.saleOrder.dateSemantics.maxObservedLagDays === null
                  ? 'hesaplanamadı'
                  : `${result.saleOrder.dateSemantics.maxObservedLagDays} gün`}.
              </p>
              <p>
                Kanıt kayıt ID’leri:{' '}
                {result.saleOrder.dateSemantics.evidenceRecordIds.length === 0
                  ? 'yok'
                  : result.saleOrder.dateSemantics.evidenceRecordIds
                      .map((recordId) => `#${recordId}`)
                      .join(', ')}
              </p>
            </div>
          </section>

          <section className="panel table-panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">Veri kalite temel raporu</span>
                <h3>Durum dağılımı ve boş kritik alanlar</h3>
              </div>
              <div className="badges">
                {result.saleOrder.stateCounts.map((state) => (
                  <span key={state.value}>
                    {state.label}: {formatCount(state.count)}
                  </span>
                ))}
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Alan</th>
                    <th>Odoo etiketi</th>
                    <th>Boş kayıt sayısı</th>
                    <th>Değerlendirme</th>
                  </tr>
                </thead>
                <tbody>
                  {result.saleOrder.missingValueCounts.map((item) => (
                    <tr key={item.field}>
                      <td>{item.field}</td>
                      <td>{item.label}</td>
                      <td>{formatCount(item.count)}</td>
                      <td>
                        {item.count === null
                          ? 'Yetki veya sorgu desteği incelenmeli'
                          : item.count === 0
                            ? 'Temiz'
                            : 'Alan eşleme öncesi kayıt bazlı inceleme gerekli'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
