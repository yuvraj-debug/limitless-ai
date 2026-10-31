import crypto from 'crypto';
import ApiKey, { IApiKey } from '../models/ApiKey';
import SystemError from '../models/SystemError';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || '12345678901234567890123456789012'; // Must be 32 bytes

// Encrypt an API key
export function encryptKey(text: string): string {
  const iv = crypto.randomBytes(16);
  // Ensure the secret is exactly 32 bytes
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_SECRET.substring(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

// Decrypt an API key
export function decryptKey(encryptedText: string): string {
  try {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_SECRET.substring(0, 32)), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Failed key decryption:', err);
    throw new Error('Key decryption failed. Please verify your ENCRYPTION_SECRET.');
  }
}

// Select the best API key: active, in group, matching modelFamily, sorted by usageCount
export async function getBestKey(modelFamily: string, groupArea: string): Promise<IApiKey | null> {
  // Find key with statusState = Active, isActive = true, matching groupArea and modelFamily
  const keyDoc = await ApiKey.findOne({
    modelFamily,
    groupArea,
    isActive: true,
    statusState: 'Active'
  }).sort({ usageCount: 1 });

  return keyDoc;
}

// Handle key failure
export async function handleKeyError(keyId: string, errorType: '429' | '401' | '403', message: string, userId?: string) {
  const key = await ApiKey.findById(keyId);
  if (!key) return;

  if (errorType === '429') {
    // Cooldown for 60 seconds
    key.statusState = 'CoolingDown';
    key.cooldownUntil = new Date(Date.now() + 60000);
    await key.save();

    await SystemError.create({
      errorType: 'API_KEY_429',
      message: `Key ${keyId.substring(0, 8)}... rate limited. Error: ${message}`,
      apiKeyId: key._id,
      userId: userId ? new crypto.webcrypto.UUID().constructor : undefined
    });
    console.warn(`Key ${keyId} placed in cooldown for 60 seconds.`);
  } else if (errorType === '401' || errorType === '403') {
    // Disable Dead key
    key.statusState = 'Dead';
    key.isActive = false;
    await key.save();

    await SystemError.create({
      errorType: 'API_KEY_DEAD',
      message: `Key ${keyId.substring(0, 8)}... failed with ${errorType}. Disabled. Error: ${message}`,
      apiKeyId: key._id
    });
    console.error(`Key ${keyId} marked DEAD and disabled.`);
  }
}

// Increment usage count safely
export async function incrementKeyUsage(keyId: string) {
  await ApiKey.updateOne({ _id: keyId }, { $inc: { usageCount: 1 } });
}

// Key restoration daemon (Revive CoolingDown keys every 30 seconds)
export function startKeyRecoveryDaemon() {
  console.log('Starting key recovery daemon...');
  setInterval(async () => {
    try {
      const now = new Date();
      // Find keys that are CoolingDown and cooldownUntil has expired
      const keysToRevive = await ApiKey.find({
        statusState: 'CoolingDown',
        cooldownUntil: { $lte: now }
      });

      for (const key of keysToRevive) {
        key.statusState = 'Active';
        key.cooldownUntil = null;
        await key.save();
        console.log(`Key ${key._id} revived to Active status.`);
      }
    } catch (err) {
      console.error('Error in key recovery daemon:', err);
    }
  }, 30000);
}
