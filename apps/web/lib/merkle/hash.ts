/**
 * Cross-platform SHA-256 hashing for Merkle tree
 * Supports both Node.js and browser environments
 */

export async function hashCommitment(commitment: string): Promise<Buffer> {
  const encoder = new TextEncoder()
  const data = encoder.encode(commitment)
  const hashBuffer = await sha256(data)

  // Convert to Buffer for Node.js compatibility
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(hashBuffer)
  }
  return Buffer.from(hashBuffer)
}

export async function hashNode(a: Buffer, b: Buffer): Promise<Buffer> {
  // Sort inputs to ensure deterministic hashing
  const sorted = a.compare(b) < 0 ? [a, b] : [b, a]
  const combined = Buffer.concat(sorted)
  const hashBuffer = await sha256(combined)

  // Convert to Buffer for Node.js compatibility
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(hashBuffer)
  }
  return Buffer.from(hashBuffer)
}

async function sha256(data: Uint8Array): Promise<ArrayBuffer> {
  // Check if we're in a browser environment with Web Crypto API
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    return await crypto.subtle.digest('SHA-256', data)
  }

  // Node.js environment
  if (typeof require !== 'undefined') {
    const crypto = require('crypto')
    return crypto.createHash('sha256').update(data).digest()
  }

  throw new Error('SHA-256 not supported in this environment')
}