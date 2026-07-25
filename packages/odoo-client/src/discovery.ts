import { OdooClientError, type OdooClient, type OdooVersionInfo } from './client.ts';

export const TENANT_DISCOVERY_MODELS = [
  'res.company',
  'res.users',
  'res.partner',
  'res.currency',
  'sale.order',
] as const;

export type TenantDiscoveryModelName = (typeof TENANT_DISCOVERY_MODELS)[number];

const FIELD_ATTRIBUTES = [
  'string',
  'type',
  'relation',
  'required',
  'readonly',
  'store',
  'selection',
  'company_dependent',
] as const;

const TARGET_FIELDS = {
  'res.company': ['name', 'active', 'parent_id', 'currency_id'],
  'res.users': ['name', 'login', 'active', 'share', 'company_id', 'company_ids'],
  'res.partner': [
    'name',
    'active',
    'company_id',
    'parent_id',
    'commercial_partner_id',
    'customer_rank',
    'country_id',
  ],
  'res.currency': ['name', 'symbol', 'active', 'decimal_places', 'position'],
  'sale.order': [
    'user_id',
    'partner_id',
    'company_id',
    'currency_id',
    'state',
    'create_date',
    'date_order',
    'amount_total',
    'validity_date',
    'write_date',
    'team_id',
  ],
} as const satisfies Record<TenantDiscoveryModelName, readonly string[]>;

interface OdooFieldDefinition {
  readonly string?: unknown;
  readonly type?: unknown;
  readonly relation?: unknown;
  readonly required?: unknown;
  readonly readonly?: unknown;
  readonly store?: unknown;
  readonly selection?: unknown;
  readonly company_dependent?: unknown;
}

type OdooFieldsGetResponse = Readonly<Record<string, OdooFieldDefinition>>;
type OdooRecord = Readonly<Record<string, unknown>>;

export interface TenantDiscoverySelectionValue {
  readonly value: string;
  readonly label: string;
}

export interface TenantDiscoveryField {
  readonly name: string;
  readonly label: string;
  readonly type: string;
  readonly relation: string | null;
  readonly required: boolean;
  readonly readonly: boolean;
  readonly stored: boolean;
  readonly companyDependent: boolean;
  readonly selection: readonly TenantDiscoverySelectionValue[];
}

export interface TenantDiscoveryModel {
  readonly model: TenantDiscoveryModelName;
  readonly available: boolean;
  readonly errorCode: string | null;
  readonly totalFieldCount: number;
  readonly customFieldCount: number;
  readonly missingTargetFields: readonly string[];
  readonly fields: readonly TenantDiscoveryField[];
}

export interface TenantDiscoveryCompany {
  readonly id: number;
  readonly name: string;
  readonly active: boolean | null;
  readonly parentId: number | null;
  readonly parentName: string | null;
  readonly currencyId: number | null;
  readonly currencyName: string | null;
}

export interface TenantDiscoveryUserCandidate {
  readonly id: number;
  readonly name: string;
  readonly maskedLogin: string | null;
  readonly active: boolean | null;
  readonly sharedUser: boolean | null;
  readonly companyId: number | null;
  readonly companyIds: readonly number[];
  readonly coversAccessibleCompanies: boolean;
}

export interface TenantDiscoveryStateCount {
  readonly value: string;
  readonly label: string;
  readonly count: number | null;
}

export interface TenantDiscoveryMissingValueCount {
  readonly field: string;
  readonly label: string;
  readonly count: number | null;
}

export interface TenantDiscoveryDateSemantics {
  readonly openSampleCount: number;
  readonly confirmedSampleCount: number;
  readonly confirmedDateOrderAfterCreateCount: number;
  readonly confirmedCrossMonthCount: number;
  readonly maxObservedLagDays: number | null;
  readonly evidenceRecordIds: readonly number[];
  readonly recommendedCohortField: 'create_date' | 'needs_review';
}

export interface TenantDiscoveryResult {
  readonly generatedAt: string;
  readonly serverVersion: string;
  readonly serverSeries: string | null;
  readonly protocolVersion: number | null;
  readonly companies: readonly TenantDiscoveryCompany[];
  readonly accessibleCompanyIds: readonly number[];
  readonly multiCompanyReadable: boolean;
  readonly integrationUserCandidates: readonly TenantDiscoveryUserCandidate[];
  readonly models: readonly TenantDiscoveryModel[];
  readonly saleOrder: {
    readonly totalCount: number | null;
    readonly stateCounts: readonly TenantDiscoveryStateCount[];
    readonly missingValueCounts: readonly TenantDiscoveryMissingValueCount[];
    readonly customFieldCount: number;
    readonly dateSemantics: TenantDiscoveryDateSemantics;
  };
}

interface ModelFieldsAttempt {
  readonly model: TenantDiscoveryModelName;
  readonly fields: OdooFieldsGetResponse;
  readonly errorCode: string | null;
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readMany2One(value: unknown): { readonly id: number | null; readonly name: string | null } {
  if (!Array.isArray(value)) {
    return { id: null, name: null };
  }

  return {
    id: readNumber(value[0]),
    name: typeof value[1] === 'string' ? value[1] : null,
  };
}

function readNumberArray(value: unknown): readonly number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
}

function readSelection(value: unknown): readonly TenantDiscoverySelectionValue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!Array.isArray(item) || typeof item[0] !== 'string' || typeof item[1] !== 'string') {
      return [];
    }

    return [{ value: item[0], label: item[1] }];
  });
}

function readServerVersion(versionInfo: OdooVersionInfo): string {
  return (
    versionInfo.version ??
    versionInfo.server_version ??
    versionInfo.server_serie ??
    'Bilinmeyen sürüm'
  );
}

function readServerSeries(versionInfo: OdooVersionInfo): string | null {
  if (typeof versionInfo.server_serie === 'string') {
    return versionInfo.server_serie;
  }

  if (typeof versionInfo.version === 'string') {
    return versionInfo.version.split('+')[0] ?? versionInfo.version;
  }

  return null;
}

function maskLogin(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const login = value.trim();
  const atIndex = login.indexOf('@');

  if (atIndex > 0) {
    return `${login.slice(0, 1)}***${login.slice(atIndex)}`;
  }

  return `${login.slice(0, Math.min(2, login.length))}***`;
}

function createField(name: string, definition: OdooFieldDefinition): TenantDiscoveryField {
  return {
    name,
    label: readString(definition.string, name),
    type: readString(definition.type, 'unknown'),
    relation: typeof definition.relation === 'string' ? definition.relation : null,
    required: definition.required === true,
    readonly: definition.readonly === true,
    stored: definition.store === true,
    companyDependent: definition.company_dependent === true,
    selection: readSelection(definition.selection),
  };
}

function createModelSummary(attempt: ModelFieldsAttempt): TenantDiscoveryModel {
  const entries = Object.entries(attempt.fields);
  const targetNames = TARGET_FIELDS[attempt.model];
  const targetSet = new Set<string>(targetNames);
  const selectedEntries = entries.filter(([name]) => targetSet.has(name) || name.startsWith('x_'));

  return {
    model: attempt.model,
    available: attempt.errorCode === null,
    errorCode: attempt.errorCode,
    totalFieldCount: entries.length,
    customFieldCount: entries.filter(([name]) => name.startsWith('x_')).length,
    missingTargetFields: targetNames.filter((name) => !(name in attempt.fields)),
    fields: selectedEntries
      .map(([name, definition]) => createField(name, definition))
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
}

async function attemptFieldsGet(
  client: OdooClient,
  model: TenantDiscoveryModelName,
): Promise<ModelFieldsAttempt> {
  try {
    const fields = await client.call<OdooFieldsGetResponse>(model, 'fields_get', {
      attributes: FIELD_ATTRIBUTES,
    });
    return { model, fields, errorCode: null };
  } catch (error) {
    if (error instanceof OdooClientError) {
      return { model, fields: {}, errorCode: error.code };
    }

    throw error;
  }
}

function getModel(
  models: readonly TenantDiscoveryModel[],
  modelName: TenantDiscoveryModelName,
): TenantDiscoveryModel {
  const model = models.find((item) => item.model === modelName);

  if (!model) {
    throw new Error(`Discovery model missing: ${modelName}`);
  }

  return model;
}

function getAvailableFieldNames(model: TenantDiscoveryModel): ReadonlySet<string> {
  return new Set(model.fields.map((field) => field.name));
}

async function safeCall<TResult>(operation: () => Promise<TResult>): Promise<TResult | null> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof OdooClientError) {
      return null;
    }

    throw error;
  }
}

async function readCompanies(
  client: OdooClient,
  companyModel: TenantDiscoveryModel,
): Promise<readonly TenantDiscoveryCompany[]> {
  if (!companyModel.available) {
    throw new OdooClientError('Company metadata could not be discovered.', {
      code: companyModel.errorCode ?? 'COMPANY_DISCOVERY_FAILED',
    });
  }

  const availableFields = getAvailableFieldNames(companyModel);
  const fields = ['id', ...TARGET_FIELDS['res.company'].filter((field) => availableFields.has(field))];
  const records = await client.call<readonly OdooRecord[]>('res.company', 'search_read', {
    domain: [],
    fields,
    order: 'id asc',
    limit: 200,
  });

  return records.flatMap((record) => {
    const id = readNumber(record.id);

    if (id === null) {
      return [];
    }

    const parent = readMany2One(record.parent_id);
    const currency = readMany2One(record.currency_id);
    return [
      {
        id,
        name: readString(record.name, `Şirket #${id}`),
        active: readBoolean(record.active),
        parentId: parent.id,
        parentName: parent.name,
        currencyId: currency.id,
        currencyName: currency.name,
      },
    ];
  });
}

async function readUserCandidates(
  client: OdooClient,
  userModel: TenantDiscoveryModel,
  accessibleCompanyIds: readonly number[],
): Promise<readonly TenantDiscoveryUserCandidate[]> {
  if (!userModel.available) {
    return [];
  }

  const availableFields = getAvailableFieldNames(userModel);
  const fields = ['id', ...TARGET_FIELDS['res.users'].filter((field) => availableFields.has(field))];
  const records = await safeCall(() =>
    client.call<readonly OdooRecord[]>('res.users', 'search_read', {
      domain: [],
      fields,
      order: 'id asc',
      limit: 200,
    }),
  );

  if (!records) {
    return [];
  }

  return records.flatMap((record) => {
    const id = readNumber(record.id);

    if (id === null) {
      return [];
    }

    const company = readMany2One(record.company_id);
    const companyIds = readNumberArray(record.company_ids);
    return [
      {
        id,
        name: readString(record.name, `Kullanıcı #${id}`),
        maskedLogin: maskLogin(record.login),
        active: readBoolean(record.active),
        sharedUser: readBoolean(record.share),
        companyId: company.id,
        companyIds,
        coversAccessibleCompanies: accessibleCompanyIds.every((companyId) =>
          companyIds.includes(companyId),
        ),
      },
    ];
  });
}

async function readStateCounts(
  client: OdooClient,
  saleOrderModel: TenantDiscoveryModel,
): Promise<readonly TenantDiscoveryStateCount[]> {
  const stateField = saleOrderModel.fields.find((field) => field.name === 'state');

  if (!saleOrderModel.available || !stateField) {
    return [];
  }

  return Promise.all(
    stateField.selection.map(async ({ value, label }) => ({
      value,
      label,
      count: await safeCall(() =>
        client.call<number>('sale.order', 'search_count', {
          domain: [['state', '=', value]],
        }),
      ),
    })),
  );
}

async function readMissingValueCounts(
  client: OdooClient,
  saleOrderModel: TenantDiscoveryModel,
): Promise<readonly TenantDiscoveryMissingValueCount[]> {
  if (!saleOrderModel.available) {
    return [];
  }

  const fields = new Map(saleOrderModel.fields.map((field) => [field.name, field]));
  const candidates = ['user_id', 'partner_id', 'company_id', 'currency_id', 'create_date', 'date_order'];

  return Promise.all(
    candidates.flatMap((fieldName) => {
      const field = fields.get(fieldName);

      if (!field) {
        return [];
      }

      return [
        (async (): Promise<TenantDiscoveryMissingValueCount> => ({
          field: fieldName,
          label: field.label,
          count: await safeCall(() =>
            client.call<number>('sale.order', 'search_count', {
              domain: [[fieldName, '=', false]],
            }),
          ),
        }))(),
      ];
    }),
  );
}

function parseOdooDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function readRecordId(record: OdooRecord): number | null {
  return readNumber(record.id);
}

function analyzeDateSemantics(
  openRecords: readonly OdooRecord[],
  confirmedRecords: readonly OdooRecord[],
): TenantDiscoveryDateSemantics {
  let confirmedDateOrderAfterCreateCount = 0;
  let confirmedCrossMonthCount = 0;
  let maxLagDays: number | null = null;
  const evidenceRecordIds: number[] = [];

  for (const record of confirmedRecords) {
    const createDate = parseOdooDate(record.create_date);
    const dateOrder = parseOdooDate(record.date_order);

    if (!createDate || !dateOrder) {
      continue;
    }

    const lagMs = dateOrder.getTime() - createDate.getTime();

    if (lagMs > 60_000) {
      confirmedDateOrderAfterCreateCount += 1;
      const lagDays = lagMs / 86_400_000;
      maxLagDays = maxLagDays === null ? lagDays : Math.max(maxLagDays, lagDays);
      const recordId = readRecordId(record);

      if (recordId !== null && evidenceRecordIds.length < 10) {
        evidenceRecordIds.push(recordId);
      }
    }

    if (
      createDate.getUTCFullYear() !== dateOrder.getUTCFullYear() ||
      createDate.getUTCMonth() !== dateOrder.getUTCMonth()
    ) {
      confirmedCrossMonthCount += 1;
    }
  }

  return {
    openSampleCount: openRecords.length,
    confirmedSampleCount: confirmedRecords.length,
    confirmedDateOrderAfterCreateCount,
    confirmedCrossMonthCount,
    maxObservedLagDays: maxLagDays === null ? null : Number(maxLagDays.toFixed(2)),
    evidenceRecordIds,
    recommendedCohortField:
      confirmedDateOrderAfterCreateCount > 0 || confirmedCrossMonthCount > 0
        ? 'create_date'
        : 'needs_review',
  };
}

async function readDateSemantics(
  client: OdooClient,
  saleOrderModel: TenantDiscoveryModel,
): Promise<TenantDiscoveryDateSemantics> {
  const empty = analyzeDateSemantics([], []);

  if (!saleOrderModel.available) {
    return empty;
  }

  const availableFields = getAvailableFieldNames(saleOrderModel);

  if (
    !availableFields.has('state') ||
    !availableFields.has('create_date') ||
    !availableFields.has('date_order')
  ) {
    return empty;
  }

  const stateField = saleOrderModel.fields.find((field) => field.name === 'state');
  const stateValues = new Set(stateField?.selection.map(({ value }) => value) ?? []);
  const fields = ['id', 'state', 'create_date', 'date_order'];
  const openStates = ['draft', 'sent'].filter((state) => stateValues.has(state));
  const confirmedStates = ['sale', 'done'].filter((state) => stateValues.has(state));

  const [openRecords, confirmedRecords] = await Promise.all([
    openStates.length === 0
      ? Promise.resolve<readonly OdooRecord[]>([])
      : safeCall(() =>
          client.call<readonly OdooRecord[]>('sale.order', 'search_read', {
            domain: [['state', 'in', openStates]],
            fields,
            order: 'create_date desc, id desc',
            limit: 100,
          }),
        ).then((records) => records ?? []),
    confirmedStates.length === 0
      ? Promise.resolve<readonly OdooRecord[]>([])
      : safeCall(() =>
          client.call<readonly OdooRecord[]>('sale.order', 'search_read', {
            domain: [['state', 'in', confirmedStates]],
            fields,
            order: 'date_order desc, id desc',
            limit: 100,
          }),
        ).then((records) => records ?? []),
  ]);

  return analyzeDateSemantics(openRecords, confirmedRecords);
}

export async function discoverOdooTenant(client: OdooClient): Promise<TenantDiscoveryResult> {
  const versionInfo = await client.getVersionInfo();
  const attempts = await Promise.all(
    TENANT_DISCOVERY_MODELS.map((model) => attemptFieldsGet(client, model)),
  );
  const models = attempts.map(createModelSummary);
  const companyModel = getModel(models, 'res.company');
  const userModel = getModel(models, 'res.users');
  const saleOrderModel = getModel(models, 'sale.order');
  const companies = await readCompanies(client, companyModel);
  const accessibleCompanyIds = companies.map(({ id }) => id);

  const [integrationUserCandidates, totalCount, stateCounts, missingValueCounts, dateSemantics] =
    await Promise.all([
      readUserCandidates(client, userModel, accessibleCompanyIds),
      saleOrderModel.available
        ? safeCall(() => client.call<number>('sale.order', 'search_count', { domain: [] }))
        : Promise.resolve(null),
      readStateCounts(client, saleOrderModel),
      readMissingValueCounts(client, saleOrderModel),
      readDateSemantics(client, saleOrderModel),
    ]);

  return {
    generatedAt: new Date().toISOString(),
    serverVersion: readServerVersion(versionInfo),
    serverSeries: readServerSeries(versionInfo),
    protocolVersion: readNumber(versionInfo.protocol_version),
    companies,
    accessibleCompanyIds,
    multiCompanyReadable: companies.length > 1,
    integrationUserCandidates,
    models,
    saleOrder: {
      totalCount,
      stateCounts,
      missingValueCounts,
      customFieldCount: saleOrderModel.customFieldCount,
      dateSemantics,
    },
  };
}
