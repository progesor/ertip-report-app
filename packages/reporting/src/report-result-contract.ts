export interface ReportDefinitionContract {
  readonly code: string;
  readonly name: string;
  readonly version: string;
  readonly metricVersion: string;
  readonly dateAxis: string;
  readonly resultMode: 'live' | 'snapshot';
}

export interface ReportBusinessUnitContract {
  readonly id: string;
  readonly displayName: string;
  readonly currencyCode: string;
}

export interface NumericReportFilterOption {
  readonly id: number;
  readonly displayName: string;
}

export interface ReportScopeContract {
  readonly businessUnitIds: readonly string[];
  readonly serverEnforced: true;
}

export interface ReportResultContract<
  TDefinition extends ReportDefinitionContract,
  TFilters,
> {
  readonly definition: TDefinition;
  readonly generatedAt: string;
  readonly lastSyncAt: string | null;
  readonly asOfDate: string;
  readonly businessUnit: ReportBusinessUnitContract;
  readonly filters: TFilters;
  readonly scope: ReportScopeContract;
}
