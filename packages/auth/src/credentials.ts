import {
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';

const PASSWORD_HASH_VERSION = 'v1';
const SCRYPT_COST = 65_536;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 128 * 1024 * 1024;

function deriveScryptKey(
  password: string,
  salt: Buffer,
  cost: number,
  blockSize: number,
  parallelization: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      {
        N: cost,
        r: blockSize,
        p: parallelization,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateEmail(value: string): string | null {
  const email = normalizeEmail(value);

  if (email.length < 3 || email.length > 320) {
    return 'Geçerli bir e-posta adresi girin.';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    return 'Geçerli bir e-posta adresi girin.';
  }

  return null;
}

export function validateDisplayName(value: string): string | null {
  const displayName = value.trim();

  if (displayName.length < 2 || displayName.length > 120) {
    return 'Ad soyad 2 ile 120 karakter arasında olmalıdır.';
  }

  return null;
}

export function validatePassword(value: string): readonly string[] {
  const errors: string[] = [];

  if (value.length < 12) {
    errors.push('Parola en az 12 karakter olmalıdır.');
  }

  if (value.length > 128) {
    errors.push('Parola en fazla 128 karakter olabilir.');
  }

  if (!/\p{Ll}/u.test(value)) {
    errors.push('Parola en az bir küçük harf içermelidir.');
  }

  if (!/\p{Lu}/u.test(value)) {
    errors.push('Parola en az bir büyük harf içermelidir.');
  }

  if (!/\d/u.test(value)) {
    errors.push('Parola en az bir rakam içermelidir.');
  }

  return errors;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await deriveScryptKey(
    password,
    salt,
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
  );

  return [
    'scrypt',
    PASSWORD_HASH_VERSION,
    String(SCRYPT_COST),
    String(SCRYPT_BLOCK_SIZE),
    String(SCRYPT_PARALLELIZATION),
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, version, costValue, blockSizeValue, parallelizationValue, saltValue, keyValue] =
    encodedHash.split('$');

  if (
    algorithm !== 'scrypt' ||
    version !== PASSWORD_HASH_VERSION ||
    costValue === undefined ||
    blockSizeValue === undefined ||
    parallelizationValue === undefined ||
    saltValue === undefined ||
    keyValue === undefined
  ) {
    return false;
  }

  const cost = Number(costValue);
  const blockSize = Number(blockSizeValue);
  const parallelization = Number(parallelizationValue);

  if (
    !Number.isSafeInteger(cost) ||
    !Number.isSafeInteger(blockSize) ||
    !Number.isSafeInteger(parallelization) ||
    cost < 2 ||
    blockSize < 1 ||
    parallelization < 1
  ) {
    return false;
  }

  let salt: Buffer;
  let expectedKey: Buffer;

  try {
    salt = Buffer.from(saltValue, 'base64url');
    expectedKey = Buffer.from(keyValue, 'base64url');
  } catch {
    return false;
  }

  if (salt.length < 16 || expectedKey.length !== SCRYPT_KEY_LENGTH) {
    return false;
  }

  const actualKey = await deriveScryptKey(password, salt, cost, blockSize, parallelization);
  return timingSafeEqual(actualKey, expectedKey);
}

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string, sessionSecret: string): string {
  return createHmac('sha256', sessionSecret).update(token).digest('hex');
}

export function hashClientIdentifier(value: string, sessionSecret: string): string {
  return createHmac('sha256', sessionSecret).update(value).digest('hex');
}

export function secureCompareSecrets(
  receivedValue: string,
  expectedValue: string,
  comparisonSecret: string,
): boolean {
  const receivedDigest = createHmac('sha256', comparisonSecret).update(receivedValue).digest();
  const expectedDigest = createHmac('sha256', comparisonSecret).update(expectedValue).digest();
  return timingSafeEqual(receivedDigest, expectedDigest);
}

export function sanitizeUserAgent(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value.replace(/[\u0000-\u001f\u007f]/gu, '').slice(0, 300) || null;
}
