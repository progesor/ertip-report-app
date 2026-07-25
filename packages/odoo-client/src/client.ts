export const READ_ONLY_ODOO_METHODS = [
  'fields_get',
  'search',
  'read',
  'search_read',
  'search_count',
] as const;

export type ReadOnlyOdooMethod = (typeof READ_ONLY_ODOO_METHODS)[number];

export interface OdooClientConfig {
  readonly baseUrl: string;
  readonly database: string;
  readonly apiKey: string;
  readonly timeoutMs?: number;
}

export interface OdooVersionInfo {
  readonly version?: string;
  readonly version_info?: readonly unknown[];
  readonly server_version?: string;
  readonly server_version_info?: readonly unknown[];
  readonly server_serie?: string;
  readonly protocol_version?: number;
  readonly [key: string]: unknown;
}

export class OdooClientError extends Error {
  public readonly status: number | undefined;
  public readonly code: string;

  public constructor(message: string, options: { status?: number; code: string; cause?: unknown }) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'OdooClientError';
    this.status = options.status;
    this.code = options.code;
  }
}

export interface OdooClient {
  readonly getVersionInfo: () => Promise<OdooVersionInfo>;
  readonly call: <TResult>(
    model: string,
    method: ReadOnlyOdooMethod,
    params?: Readonly<Record<string, unknown>>,
  ) => Promise<TResult>;
}

function normalizeBaseUrl(value: string): URL {
  const url = new URL(value);
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) {
    throw new OdooClientError('Odoo base URL must use HTTPS.', {
      code: 'INVALID_BASE_URL',
    });
  }

  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';
  return url;
}

function validateModel(model: string): string {
  if (!/^[a-z][a-z0-9_.]+$/u.test(model)) {
    throw new OdooClientError('Invalid Odoo model name.', { code: 'INVALID_MODEL' });
  }

  return model;
}

function validateMethod(method: string): asserts method is ReadOnlyOdooMethod {
  if (!READ_ONLY_ODOO_METHODS.includes(method as ReadOnlyOdooMethod)) {
    throw new OdooClientError('The requested Odoo method is not permitted.', {
      code: 'WRITE_METHOD_BLOCKED',
    });
  }
}

function createTimeoutSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

async function readJsonSafely(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function classifyHttpError(status: number): string {
  if (status === 401) {
    return 'AUTHENTICATION_FAILED';
  }

  if (status === 403) {
    return 'ACCESS_DENIED';
  }

  if (status === 404) {
    return 'ENDPOINT_NOT_FOUND';
  }

  if (status === 422) {
    return 'REQUEST_REJECTED';
  }

  if (status === 429) {
    return 'RATE_LIMITED';
  }

  if (status >= 500) {
    return 'ODOO_UNAVAILABLE';
  }

  return 'HTTP_ERROR';
}

function classifyNetworkError(error: unknown): string {
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return 'TIMEOUT';
  }

  return 'NETWORK_ERROR';
}

export function createOdooClient(
  config: OdooClientConfig,
  dependencies: { readonly fetch?: typeof fetch } = {},
): OdooClient {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const timeoutMs = config.timeoutMs ?? 15000;
  const request = dependencies.fetch ?? fetch;

  if (!config.database.trim()) {
    throw new OdooClientError('Odoo database is required.', { code: 'MISSING_DATABASE' });
  }

  if (!config.apiKey.trim()) {
    throw new OdooClientError('Odoo API key is required.', { code: 'MISSING_API_KEY' });
  }

  async function execute(url: URL, init: RequestInit): Promise<unknown> {
    let response: Response;

    try {
      response = await request(url, {
        ...init,
        signal: createTimeoutSignal(timeoutMs),
      });
    } catch (error) {
      throw new OdooClientError('Odoo request failed before receiving a response.', {
        code: classifyNetworkError(error),
        cause: error,
      });
    }

    const payload = await readJsonSafely(response);

    if (!response.ok) {
      throw new OdooClientError(`Odoo request failed with HTTP ${response.status}.`, {
        status: response.status,
        code: classifyHttpError(response.status),
      });
    }

    return payload;
  }

  return {
    async getVersionInfo() {
      const url = new URL('/web/version', baseUrl);
      const payload = await execute(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'ErtipReportApp/0.2',
        },
      });

      return (payload ?? {}) as OdooVersionInfo;
    },

    async call<TResult>(
      model: string,
      method: ReadOnlyOdooMethod,
      params: Readonly<Record<string, unknown>> = {},
    ): Promise<TResult> {
      validateMethod(method);
      const safeModel = validateModel(model);
      const url = new URL(
        `/json/2/${encodeURIComponent(safeModel)}/${encodeURIComponent(method)}`,
        baseUrl,
      );

      const payload = await execute(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'ErtipReportApp/0.2',
          'X-Odoo-Database': config.database,
        },
        body: JSON.stringify(params),
      });

      return payload as TResult;
    },
  };
}
