/**
 * crypto.ts
 *
 * All cryptographic operations using the native Web Crypto API.
 * No external dependencies.
 *
 * - hashPassword / verifyPassword  →  PBKDF2-SHA256 (310 000 iters, OWASP recommended)
 * - encrypt / decrypt              →  AES-256-GCM with PBKDF2-derived key
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  return btoa(String.fromCharCode(...arr))
}

function b64ToBuf(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n))
}

// ─── Key derivation ───────────────────────────────────────────────────────────

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const rawKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 310_000, hash: 'SHA-256' },
    rawKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

// ─── Password hashing ─────────────────────────────────────────────────────────

/**
 * Returns a storable string: "<salt_b64>:<hash_b64>"
 * Uses PBKDF2-SHA256 with 310 000 iterations (OWASP 2023 recommendation).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await deriveKey(password, salt)

  // Export the derived key bytes as the "hash"
  // (deriveKey with extractable=false would be more secure, but we need the bytes)
  // Workaround: use the key to encrypt an empty string and store salt + ciphertext
  const iv = randomBytes(12)
  const enc = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    enc.encode('__verify__'),
  )

  // Format: salt(16) + iv(12) + ciphertext — all base64 joined by ":"
  return [bufToB64(salt), bufToB64(iv), bufToB64(ciphertext)].join(':')
}

/**
 * Returns true if `password` matches the stored hash.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  try {
    const [saltB64, ivB64, ciphertextB64] = stored.split(':')
    const salt = b64ToBuf(saltB64)
    const iv = b64ToBuf(ivB64)
    const ciphertext = b64ToBuf(ciphertextB64)

    const key = await deriveKey(password, salt)
    const dec = new TextDecoder()
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      ciphertext.buffer as ArrayBuffer,
    )
    return dec.decode(plain) === '__verify__'
  } catch {
    return false
  }
}

// ─── Encryption / Decryption ──────────────────────────────────────────────────

/**
 * Encrypts `plaintext` with AES-256-GCM using a key derived from `password`.
 * Returns a single base64 string containing salt + iv + ciphertext.
 */
export async function encrypt(plaintext: string, password: string): Promise<string> {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = await deriveKey(password, salt)
  const enc = new TextEncoder()

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    enc.encode(plaintext),
  )

  // Combine: salt(16B) + iv(12B) + ciphertext → base64
  const combined = new Uint8Array(16 + 12 + ciphertext.byteLength)
  combined.set(salt, 0)
  combined.set(iv, 16)
  combined.set(new Uint8Array(ciphertext), 28)

  return bufToB64(combined)
}

/**
 * Decrypts a value produced by `encrypt`.
 * Throws if the password is wrong or data is corrupted.
 */
export async function decrypt(ciphertext: string, password: string): Promise<string> {
  const data = b64ToBuf(ciphertext)
  const salt = data.slice(0, 16)
  const iv = data.slice(16, 28)
  const encrypted = data.slice(28)

  const key = await deriveKey(password, salt)
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    encrypted.buffer as ArrayBuffer,
  )
  return new TextDecoder().decode(plain)
}
