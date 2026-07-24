export type AppEnvironment = 'development' | 'test' | 'staging' | 'production';

export interface RuntimeConfig {
  readonly appEnvironment: AppEnvironment;
  readonly demoMode: boolean;
  readonly appName: string;
  readonly odoo: {
    readonly baseUrl?: string;
    readonly database?: string;
    readonly apiKey?: string;
    readonly timeoutMs: number;
    readonly configured: boolean;
  };
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return value.trim().toLowerCase() === 'true';
}

function readEnvironment(value: string | undefined): AppEnvironment {
  if (value === 'test' || value === 'staging' || value === 'production') {
    return value;
  }

  return 'development';
}

function readTimeout(value: string | undefined): number {
  const parsed = Number(value ?? '15000');
  return Number.isFinite(parsed) && parsed >= 1000 && parsed <= 120000 ? parsed : 15000;
}

export function readRuntimeConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): RuntimeConfig {
  const baseUrl = env.ODOO_BASE_URL?.trim() || undefined;
  const database = env.ODOO_DATABASE?.trim() || undefined;
  const apiKey = env.ODOO_API_KEY?.trim() || undefined;

  return {
    appEnvironment: readEnvironment(env.APP_ENV),
    demoMode: readBoolean(env.APP_DEMO_MODE, false),
    appName: env.NEXT_PUBLIC_APP_NAME?.trim() || 'Ertip Report App',
    odoo: {
      ...(baseUrl === undefined ? {} : { baseUrl }),
      ...(database === undefined ? {} : { database }),
      ...(apiKey === undefined ? {} : { apiKey }),
      timeoutMs: readTimeout(env.ODOO_REQUEST_TIMEOUT_MS),
      configured: Boolean(baseUrl && database && apiKey),
    },
  };
}

export function getSafeRuntimeStatus(config: RuntimeConfig) {
  return {
    appEnvironment: config.appEnvironment,
    demoMode: config.demoMode,
    appName: config.appName,
    odoo: {
      configured: config.odoo.configured,
      host: config.odoo.baseUrl ? new URL(config.odoo.baseUrl).host : null,
      databaseConfigured: Boolean(config.odoo.database),
      apiKeyConfigured: Boolean(config.odoo.apiKey),
    },
  } as const;
}
