export type AppEnvironment = 'development' | 'test' | 'staging' | 'production';

export interface RuntimeConfig {
  readonly appEnvironment: AppEnvironment;
  readonly demoMode: boolean;
  readonly appName: string;
  readonly database: {
    readonly connectionString?: string;
    readonly ssl: boolean;
    readonly configured: boolean;
  };
  readonly authentication: {
    readonly sessionSecret?: string;
    readonly ownerBootstrapToken?: string;
    readonly sessionTtlHours: number;
    readonly configured: boolean;
    readonly bootstrapConfigured: boolean;
  };
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

function readSessionTtlHours(value: string | undefined): number {
  const parsed = Number(value ?? '12');
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 168 ? parsed : 12;
}

export function readRuntimeConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): RuntimeConfig {
  const databaseConnectionString = env.DATABASE_URL?.trim() || undefined;
  const sessionSecret = env.SESSION_SECRET?.trim() || undefined;
  const ownerBootstrapToken = env.OWNER_BOOTSTRAP_TOKEN?.trim() || undefined;
  const baseUrl = env.ODOO_BASE_URL?.trim() || undefined;
  const database = env.ODOO_DATABASE?.trim() || undefined;
  const apiKey = env.ODOO_API_KEY?.trim() || undefined;

  return {
    appEnvironment: readEnvironment(env.APP_ENV),
    demoMode: readBoolean(env.APP_DEMO_MODE, false),
    appName: env.NEXT_PUBLIC_APP_NAME?.trim() || 'Ertip Report App',
    database: {
      ...(databaseConnectionString === undefined
        ? {}
        : { connectionString: databaseConnectionString }),
      ssl: readBoolean(env.DATABASE_SSL, false),
      configured: Boolean(databaseConnectionString),
    },
    authentication: {
      ...(sessionSecret === undefined ? {} : { sessionSecret }),
      ...(ownerBootstrapToken === undefined ? {} : { ownerBootstrapToken }),
      sessionTtlHours: readSessionTtlHours(env.SESSION_TTL_HOURS),
      configured: Boolean(sessionSecret && sessionSecret.length >= 32),
      bootstrapConfigured: Boolean(ownerBootstrapToken && ownerBootstrapToken.length >= 24),
    },
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
    database: {
      configured: config.database.configured,
      ssl: config.database.ssl,
    },
    authentication: {
      configured: config.authentication.configured,
      bootstrapConfigured: config.authentication.bootstrapConfigured,
      sessionTtlHours: config.authentication.sessionTtlHours,
    },
    odoo: {
      configured: config.odoo.configured,
      host: config.odoo.baseUrl ? new URL(config.odoo.baseUrl).host : null,
      databaseConfigured: Boolean(config.odoo.database),
      apiKeyConfigured: Boolean(config.odoo.apiKey),
    },
  } as const;
}
