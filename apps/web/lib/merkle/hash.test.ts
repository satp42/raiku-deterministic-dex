import { describe, it, expect } from 'vitest'
import { hashCommitment, hashNode } from './hash'

describe('hash', () => {
  it('hashCommitment produces consistent output', async () => {
    const commitment1 = 'test-commitment-1'
    const commitment2 = 'test-commitment-2'

    const hash1a = await hashCommitment(commitment1)
    const hash1b = await hashCommitment(commitment1)
    const hash2 = await hashCommitment(commitment2)

    expect(hash1a).toEqual(hash1b)
    expect(hash1a).not.toEqual(hash2)
    expect(hash1a.length).toBe(32)
    expect(hash2.length).toBe(32)
  })

  it('hashNode produces consistent output', async () => {
    const buffer1 = Buffer.from('00'.repeat(16), 'hex')
    const buffer2 = Buffer.from('11'.repeat(16), 'hex')
    const buffer3 = Buffer.from('22'.repeat(16), 'hex')

    const hash1a = await hashNode(buffer1, buffer2)
    const hash1b = await hashNode(buffer1, buffer2)
    const hash2 = await hashNode(buffer1, buffer3)

    expect(hash1a).toEqual(hash1b)
    expect(hash1a).not.toEqual(hash2)
    expect(hash1a.length).toBe(32)
  })

  it('hashNode is commutative (order independent)', async () => {
    const buffer1 = Buffer.from('aa'.repeat(16), 'hex')
    const buffer2 = Buffer.from('bb'.repeat(16), 'hex')

    const hash12 = await hashNode(buffer1, buffer2)
    const hash21 = await hashNode(buffer2, buffer1)

    // Should produce same hash regardless of order (deterministic sorting)
    expect(hash12).toEqual(hash21)
  })

  it('hashNode produces different output for different inputs', async () => {
    const buffer1 = Buffer.from('00'.repeat(16), 'hex')
    const buffer2 = Buffer.from('11'.repeat(16), 'hex')

    const hash1 = await hashNode(buffer1, buffer1)
    const hash2 = await hashNode(buffer1, buffer2)
    const hash3 = await hashNode(buffer2, buffer2)

    expect(hash1).not.toEqual(hash2)
    expect(hash2).not.toEqual(hash3)
  })
})