import { describe, it, expect } from 'vitest'
import { buildTree, getProof, verify } from './tree'

// Test vectors for deterministic verification
const testVectors = [
  // Single leaf
  {
    leaves: [Buffer.from('00'.repeat(16), 'hex')],
    expectedRoot: '00000000000000000000000000000000'
  },
  // Two leaves
  {
    leaves: [
      Buffer.from('00'.repeat(16), 'hex'),
      Buffer.from('11'.repeat(16), 'hex')
    ],
    expectedRoot: '81bf40f1b15f7cc84a210c41bb2ce661d4ad809d7911a3161d153de12bf5bcc5'
  },
  // Four leaves
  {
    leaves: [
      Buffer.from('00'.repeat(16), 'hex'),
      Buffer.from('11'.repeat(16), 'hex'),
      Buffer.from('22'.repeat(16), 'hex'),
      Buffer.from('33'.repeat(16), 'hex')
    ],
    expectedRoot: '70df33717ba26d14d566efe622ecd4a64f101709b10b14214af8d703bd1b83e7'
  }
]

describe('Merkle Tree', () => {
  describe('buildTree', () => {
    it('builds tree with single leaf', async () => {
      const leaves = [Buffer.from('leaf1')]
      const tree = await buildTree(leaves)

      expect(tree.leaves).toHaveLength(1)
      expect(tree.leaves[0]).toEqual(leaves[0])
      expect(tree.tree).toHaveLength(1) // Only leaf level
      expect(tree.root).toEqual(tree.leaves[0])
    })

    it('builds tree with two leaves', async () => {
      const leaves = [
        Buffer.from('leaf1'),
        Buffer.from('leaf2')
      ]
      const tree = await buildTree(leaves)

      expect(tree.leaves).toHaveLength(2)
      expect(tree.tree).toHaveLength(2) // Leaf level + root level
      expect(tree.tree[1]).toHaveLength(1) // Single root
    })

    it('builds tree with four leaves', async () => {
      const leaves = [
        Buffer.from('leaf1'),
        Buffer.from('leaf2'),
        Buffer.from('leaf3'),
        Buffer.from('leaf4')
      ]
      const tree = await buildTree(leaves)

      expect(tree.leaves).toHaveLength(4)
      expect(tree.tree).toHaveLength(3) // Leaf + 2 internal levels
      expect(tree.tree[2]).toHaveLength(1) // Single root
    })

    it('pads to power of 2', async () => {
      const leaves = [
        Buffer.from('leaf1'),
        Buffer.from('leaf2'),
        Buffer.from('leaf3')
      ]
      const tree = await buildTree(leaves)

      expect(tree.leaves).toHaveLength(4) // Padded to 4
      expect(tree.leaves[3].equals(Buffer.alloc(32))).toBe(true) // Zero padding
    })

    it('produces deterministic roots for same inputs', async () => {
      const leaves = [Buffer.from('test')]
      const tree1 = await buildTree(leaves)
      const tree2 = await buildTree(leaves)

      expect(tree1.root).toEqual(tree2.root)
    })
  })

  describe('getProof', () => {
    it('returns null for invalid index', async () => {
      const leaves = [Buffer.from('leaf1'), Buffer.from('leaf2')]
      const tree = await buildTree(leaves)

      expect(await getProof(tree, -1)).toBeNull()
      expect(await getProof(tree, 2)).toBeNull()
    })

    it('generates proof for first leaf', async () => {
      const leaves = [
        Buffer.from('leaf1'),
        Buffer.from('leaf2'),
        Buffer.from('leaf3'),
        Buffer.from('leaf4')
      ]
      const tree = await buildTree(leaves)
      const proof = await getProof(tree, 0)

      expect(proof).not.toBeNull()
      expect(proof!.index).toBe(0)
      expect(proof!.leaf).toEqual(leaves[0])
      expect(proof!.path.length).toBeGreaterThan(0)
    })

    it('generates proof for middle leaf', async () => {
      const leaves = [
        Buffer.from('leaf1'),
        Buffer.from('leaf2'),
        Buffer.from('leaf3'),
        Buffer.from('leaf4')
      ]
      const tree = await buildTree(leaves)
      const proof = await getProof(tree, 2)

      expect(proof).not.toBeNull()
      expect(proof!.index).toBe(2)
      expect(proof!.leaf).toEqual(leaves[2])
    })
  })

  describe('verify', () => {
    it('verifies correct proof', async () => {
      const leaves = [
        Buffer.from('leaf1'),
        Buffer.from('leaf2'),
        Buffer.from('leaf3'),
        Buffer.from('leaf4')
      ]
      const tree = await buildTree(leaves)
      const proof = await getProof(tree, 1)

      expect(proof).not.toBeNull()
      const isValid = await verify(proof!.leaf, proof!, tree.root)
      expect(isValid).toBe(true)
    })

    it('rejects proof for wrong leaf', async () => {
      const leaves = [
        Buffer.from('leaf1'),
        Buffer.from('leaf2'),
        Buffer.from('leaf3'),
        Buffer.from('leaf4')
      ]
      const tree = await buildTree(leaves)
      const proof = await getProof(tree, 0)

      expect(proof).not.toBeNull()
      // Try to verify with wrong leaf
      const isValid = await verify(leaves[1], proof!, tree.root)
      expect(isValid).toBe(false)
    })

    it('rejects proof for wrong root', async () => {
      const leaves = [
        Buffer.from('leaf1'),
        Buffer.from('leaf2')
      ]
      const tree = await buildTree(leaves)
      const proof = await getProof(tree, 0)

      expect(proof).not.toBeNull()
      const wrongRoot = Buffer.from('ff'.repeat(32), 'hex')
      const isValid = await verify(proof!.leaf, proof!, wrongRoot)
      expect(isValid).toBe(false)
    })
  })

  describe('Known Test Vectors', () => {
    testVectors.forEach((vector, index) => {
      it(`verifies test vector ${index + 1} (${vector.leaves.length} leaves)`, async () => {
        const tree = await buildTree(vector.leaves)
        const expectedRoot = Buffer.from(vector.expectedRoot, 'hex')

        expect(tree.root.equals(expectedRoot)).toBe(true)

        // Verify all leaves have valid proofs
        for (let i = 0; i < vector.leaves.length; i++) {
          const proof = await getProof(tree, i)
          expect(proof).not.toBeNull()

          const isValid = await verify(proof!.leaf, proof!, tree.root)
          expect(isValid).toBe(true)
        }
      })
    })
  })

  describe('Large Tree (8 leaves)', () => {
    it('handles 8 leaves correctly', async () => {
      const leaves = Array.from({ length: 8 }, (_, i) =>
        Buffer.from(`leaf${i}`)
      )
      const tree = await buildTree(leaves)

      expect(tree.leaves).toHaveLength(8)
      expect(tree.tree).toHaveLength(4) // 3 levels + root

      // Verify all proofs
      for (let i = 0; i < leaves.length; i++) {
        const proof = await getProof(tree, i)
        expect(proof).not.toBeNull()

        const isValid = await verify(proof!.leaf, proof!, tree.root)
        expect(isValid).toBe(true)
      }
    })
  })
})