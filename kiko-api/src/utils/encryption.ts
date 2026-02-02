/**
 * Encryption utility for sensitive data
 * Uses AES-256-GCM for authenticated encryption
 */

import crypto from 'crypto';

// Get encryption key from environment (must be 32 bytes for AES-256)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

// Validate key on startup
if (!ENCRYPTION_KEY) {
    console.warn('[Encryption] ⚠️ ENCRYPTION_KEY not set! Sensitive data will be stored in plaintext.');
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Check if encryption is available
 */
export function isEncryptionAvailable(): boolean {
    return ENCRYPTION_KEY.length === 32;
}

/**
 * Encrypt a string using AES-256-GCM
 * Returns: iv:authTag:ciphertext (all base64 encoded)
 */
export function encrypt(plaintext: string): string {
    if (!isEncryptionAvailable()) {
        // Return plaintext if encryption is not available (legacy support)
        console.warn('[Encryption] Encryption unavailable, storing plaintext');
        return plaintext;
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv, {
        authTagLength: AUTH_TAG_LENGTH
    });

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:ciphertext (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt a string encrypted with encrypt()
 * Handles both encrypted (iv:authTag:ciphertext) and plaintext for migration
 */
export function decrypt(encryptedData: string): string {
    // Check if data is plaintext (no colons = legacy unencrypted data)
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
        // Legacy plaintext data - return as-is
        return encryptedData;
    }

    if (!isEncryptionAvailable()) {
        console.error('[Encryption] Cannot decrypt - ENCRYPTION_KEY not set');
        throw new Error('Encryption key not configured');
    }

    const [ivBase64, authTagBase64, ciphertext] = parts;

    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv, {
        authTagLength: AUTH_TAG_LENGTH
    });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/**
 * Check if data is encrypted (has iv:authTag:ciphertext format)
 */
export function isEncrypted(data: string): boolean {
    const parts = data.split(':');
    return parts.length === 3 && parts.every(p => p.length > 0);
}
