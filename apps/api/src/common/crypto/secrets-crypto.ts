import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const KDF_SALT = 'tzj-integration-secrets-v1';

/** 2FA TOTP Secret 加密域（与集成凭证密钥域隔离，防跨模块密文互解） */
export const CRYPTO_CONTEXT_2FA = 'tzj-2fa-totp-v1';

function deriveKey(passphrase: string, context: string = KDF_SALT): Buffer {
  if (passphrase.length < 32) {
    throw new Error('SECRETS_ENCRYPTION_KEY must be at least 32 characters');
  }
  return scryptSync(passphrase, context, 32);
}

/** AES-256-GCM 加密任意字符串，context 参与 KDF salt 实现域分离；返回 base64(iv + tag + ciphertext)。 */
export function encryptString(plaintext: string, encryptionKey: string, context: string): string {
  const key = deriveKey(encryptionKey, context);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/** 解密 encryptString 产物（context 必须与加密时一致，否则 auth tag 校验失败抛错）。 */
export function decryptString(blob: string, encryptionKey: string, context: string): string {
  const key = deriveKey(encryptionKey, context);
  const buf = Buffer.from(blob, 'base64');
  if (buf.length <= IV_LEN + TAG_LEN) {
    throw new Error('Invalid encrypted blob');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const encrypted = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/** AES-256-GCM 加密 JSON 凭证对象，返回 base64(iv + tag + ciphertext)。 */
export function encryptSecrets(payload: Record<string, string>, encryptionKey: string): string {
  const key = deriveKey(encryptionKey);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/** 解密 encryptSecrets 产物。 */
export function decryptSecrets(blob: string, encryptionKey: string): Record<string, string> {
  const key = deriveKey(encryptionKey);
  const buf = Buffer.from(blob, 'base64');
  if (buf.length <= IV_LEN + TAG_LEN) {
    throw new Error('Invalid encrypted secrets blob');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const encrypted = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  const parsed = JSON.parse(plaintext) as Record<string, string>;
  return parsed;
}

/** 掩码展示：仅保留末 4 位。 */
export function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 4) return '****';
  return `${'*'.repeat(8)}${trimmed.slice(-4)}`;
}
