// socialsync-pro-backend/src/utils/crypto.js
import crypto from 'crypto';

function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw new Error('ENCRYPTION_KEY manquante ou trop courte (32 caractères minimum).');
  }
  // Dérive une clé de 256 bits quelle que soit la longueur de la variable
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v2:${iv.toString('hex')}:${tag.toString('hex')}:${data.toString('hex')}`;
}

// Retourne null si la valeur est absente, ancienne (non v2) ou corrompue.
export function decryptSecret(payload) {
  if (!payload) return null;
  const [version, ivHex, tagHex, dataHex] = String(payload).split(':');
  if (version !== 'v2') return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}
