export const REPORT_CATEGORIES = [
  'Satış ve Teklifler',
  'Müşteriler',
  'Ekip Performansı',
  'Operasyonel Takip',
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];
export type ReportAccent = 'cyan' | 'amber' | 'green' | 'violet' | 'rose';

export interface ReportCatalogItem {
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly category: ReportCategory;
  readonly href: string;
  readonly accent: ReportAccent;
  readonly capabilities: readonly string[];
  readonly dateAxis: string;
}

export const REPORT_CATALOG: readonly ReportCatalogItem[] = [
  {
    code: 'international-monthly-quotation-performance',
    title: 'Aylık Teklif Performansı',
    description:
      'Teklif üretimini, gerçekleşen satışları, açık ve gerçekleşmeyen kayıtları dönemsel olarak karşılaştırın.',
    category: 'Satış ve Teklifler',
    href: '/reports/monthly-quotation-performance',
    accent: 'cyan',
    capabilities: ['Dönem karşılaştırması', 'Personel ve müşteri kırılımı', 'XLSX ve PDF'],
    dateAxis: 'Teklif oluşturma tarihi',
  },
  {
    code: 'quotation-to-order-conversion',
    title: 'Tekliften Siparişe Dönüşüm',
    description:
      'Teklif kohortlarının satışa dönüşme oranını, süre dağılımını ve çapraz ay gerçekleşmelerini inceleyin.',
    category: 'Satış ve Teklifler',
    href: '/reports/quotation-conversion',
    accent: 'violet',
    capabilities: ['Dönüşüm süresi', 'Aynı ay / çapraz ay', 'Kaynak tarih anomalileri'],
    dateAxis: 'Teklif ve onay tarihleri',
  },
  {
    code: 'customer-quotation-history',
    title: 'Müşteri Teklif Geçmişi',
    description:
      'Bir müşterinin tüm teklif zaman çizelgesini, tekrar sıklığını ve satış sonuçlarını tek görünümde takip edin.',
    category: 'Müşteriler',
    href: '/reports/customer-quotation-history',
    accent: 'amber',
    capabilities: ['Müşteri arama', 'Zaman çizelgesi', 'Kaynak para birimi tutarları'],
    dateAxis: 'Teklif oluşturma tarihi',
  },
  {
    code: 'personnel-performance',
    title: 'Personel Performansı',
    description:
      'Satış personelini ekip medyanı, müşteri kapsamı, dönüşüm ve tutar performansıyla karşılaştırın.',
    category: 'Ekip Performansı',
    href: '/reports/personnel-performance',
    accent: 'green',
    capabilities: ['Ekip medyanı', 'Müşteri yoğunluğu', 'Kaynak para birimi tutarları'],
    dateAxis: 'Teklif oluşturma tarihi',
  },
  {
    code: 'open-aging-quotations',
    title: 'Açık ve Yaşlanan Teklifler',
    description:
      'Takip bekleyen teklifleri yaş, geçerlilik tarihi, sorumlu personel ve müşteri bazında önceliklendirin.',
    category: 'Operasyonel Takip',
    href: '/reports/open-aging-quotations',
    accent: 'rose',
    capabilities: ['Yaş kovaları', 'Geçerlilik takibi', 'Açık tutar analizi'],
    dateAxis: 'Teklif yaşı ve geçerlilik tarihi',
  },
] as const;

export function reportsByCategory(category: ReportCategory): readonly ReportCatalogItem[] {
  return REPORT_CATALOG.filter((report) => report.category === category);
}
