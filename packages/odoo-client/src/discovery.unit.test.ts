import assert from 'node:assert/strict';
import test from 'node:test';

import { OdooClientError, type OdooClient, type ReadOnlyOdooMethod } from './client.ts';
import { discoverOdooTenant } from './discovery.ts';

function createField(
  label: string,
  type: string,
  options: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    string: label,
    type,
    required: false,
    readonly: false,
    store: true,
    ...options,
  };
}

const modelFields = {
  'res.company': {
    name: createField('Company Name', 'char'),
    active: createField('Active', 'boolean'),
    parent_id: createField('Parent Company', 'many2one', { relation: 'res.company' }),
    currency_id: createField('Currency', 'many2one', { relation: 'res.currency' }),
  },
  'res.users': {
    name: createField('Name', 'char'),
    login: createField('Login', 'char'),
    active: createField('Active', 'boolean'),
    share: createField('Share User', 'boolean'),
    company_id: createField('Company', 'many2one', { relation: 'res.company' }),
    company_ids: createField('Allowed Companies', 'many2many', { relation: 'res.company' }),
  },
  'res.partner': {
    name: createField('Name', 'char'),
    active: createField('Active', 'boolean'),
    company_id: createField('Company', 'many2one', { relation: 'res.company' }),
    parent_id: createField('Parent', 'many2one', { relation: 'res.partner' }),
    commercial_partner_id: createField('Commercial Entity', 'many2one', {
      relation: 'res.partner',
    }),
    customer_rank: createField('Customer Rank', 'integer'),
    country_id: createField('Country', 'many2one', { relation: 'res.country' }),
  },
  'res.currency': {
    name: createField('Currency', 'char'),
    symbol: createField('Symbol', 'char'),
    active: createField('Active', 'boolean'),
    decimal_places: createField('Decimal Places', 'integer'),
    position: createField('Symbol Position', 'selection'),
  },
  'sale.order': {
    user_id: createField('Salesperson', 'many2one', { relation: 'res.users' }),
    partner_id: createField('Customer', 'many2one', { relation: 'res.partner' }),
    company_id: createField('Company', 'many2one', { relation: 'res.company' }),
    currency_id: createField('Currency', 'many2one', { relation: 'res.currency' }),
    state: createField('Status', 'selection', {
      selection: [
        ['draft', 'Quotation'],
        ['sent', 'Quotation Sent'],
        ['sale', 'Sales Order'],
        ['cancel', 'Cancelled'],
      ],
    }),
    create_date: createField('Created on', 'datetime'),
    date_order: createField('Order Date', 'datetime'),
    amount_total: createField('Total', 'monetary'),
    validity_date: createField('Expiration', 'date'),
    write_date: createField('Last Updated on', 'datetime'),
    team_id: createField('Sales Team', 'many2one', { relation: 'crm.team' }),
    x_studio_result: createField('Studio Result', 'selection', {
      selection: [
        ['won', 'Won'],
        ['lost', 'Lost'],
      ],
    }),
  },
} as const;

function readDomain(params: Readonly<Record<string, unknown>> | undefined): string {
  return JSON.stringify(params?.domain ?? []);
}

function createDiscoveryClient(options: { readonly denyUsers?: boolean } = {}): OdooClient {
  return {
    async getVersionInfo() {
      return { version: '19.0+e', server_serie: '19.0', protocol_version: 1 };
    },
    async call<TResult>(
      model: string,
      method: ReadOnlyOdooMethod,
      params?: Readonly<Record<string, unknown>>,
    ): Promise<TResult> {
      if (method === 'fields_get') {
        if (model === 'res.users' && options.denyUsers === true) {
          throw new OdooClientError('denied', { status: 403, code: 'ACCESS_DENIED' });
        }

        const fields = modelFields[model as keyof typeof modelFields];

        if (!fields) {
          throw new Error(`Unexpected fields_get model: ${model}`);
        }

        return fields as TResult;
      }

      if (model === 'res.company' && method === 'search_read') {
        return [
          {
            id: 3,
            name: 'Ertip Domestic',
            active: true,
            parent_id: false,
            currency_id: [31, 'TRY'],
          },
          {
            id: 7,
            name: 'Ertip Export',
            active: true,
            parent_id: false,
            currency_id: [2, 'USD'],
          },
        ] as TResult;
      }

      if (model === 'res.users' && method === 'search_read') {
        return [
          {
            id: 11,
            name: 'Integration User',
            login: 'integration@example.com',
            active: true,
            share: false,
            company_id: [7, 'Ertip Export'],
            company_ids: [3, 7],
          },
        ] as TResult;
      }

      if (model === 'sale.order' && method === 'search_count') {
        const domain = readDomain(params);
        const counts: Readonly<Record<string, number>> = {
          '[]': 42,
          '[["state","=","draft"]]': 18,
          '[["state","=","sent"]]': 6,
          '[["state","=","sale"]]': 15,
          '[["state","=","cancel"]]': 3,
          '[["user_id","=",false]]': 2,
          '[["partner_id","=",false]]': 0,
          '[["company_id","=",false]]': 0,
          '[["currency_id","=",false]]': 0,
          '[["create_date","=",false]]': 0,
          '[["date_order","=",false]]': 0,
        };
        return (counts[domain] ?? 0) as TResult;
      }

      if (model === 'sale.order' && method === 'search_read') {
        const domain = readDomain(params);

        if (domain.includes('"sale"')) {
          return [
            {
              id: 901,
              state: 'sale',
              create_date: '2026-06-30 15:00:00',
              date_order: '2026-07-02 10:00:00',
            },
          ] as TResult;
        }

        return [
          {
            id: 902,
            state: 'draft',
            create_date: '2026-07-20 12:00:00',
            date_order: '2026-07-20 12:00:00',
          },
        ] as TResult;
      }

      throw new Error(`Unexpected Odoo call: ${model}/${method}`);
    },
  };
}

test('discovers companies, fields, data quality, and live date evidence', async () => {
  const result = await discoverOdooTenant(createDiscoveryClient());

  assert.equal(result.serverVersion, '19.0+e');
  assert.deepEqual(result.accessibleCompanyIds, [3, 7]);
  assert.equal(result.multiCompanyReadable, true);
  assert.equal(result.integrationUserCandidates[0]?.maskedLogin, 'i***@example.com');
  assert.equal(result.integrationUserCandidates[0]?.coversAccessibleCompanies, true);
  assert.equal(result.saleOrder.totalCount, 42);
  assert.equal(result.saleOrder.customFieldCount, 1);
  assert.equal(result.saleOrder.dateSemantics.confirmedCrossMonthCount, 1);
  assert.equal(result.saleOrder.dateSemantics.recommendedCohortField, 'create_date');
  assert.deepEqual(result.saleOrder.dateSemantics.evidenceRecordIds, [901]);
  assert.equal(
    result.saleOrder.missingValueCounts.find(({ field }) => field === 'user_id')?.count,
    2,
  );
});

test('keeps discovery usable when res.users metadata is access denied', async () => {
  const result = await discoverOdooTenant(createDiscoveryClient({ denyUsers: true }));
  const userModel = result.models.find(({ model }) => model === 'res.users');

  assert.equal(userModel?.available, false);
  assert.equal(userModel?.errorCode, 'ACCESS_DENIED');
  assert.deepEqual(result.integrationUserCandidates, []);
  assert.equal(result.companies.length, 2);
});
