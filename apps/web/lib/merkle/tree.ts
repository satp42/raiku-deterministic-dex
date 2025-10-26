import { hashNode } from './hash'

export interface MerkleProof {
  leaf: Buffer
  index: number
  path: Buffer[]
}

export interface MerkleTree {
  root: Buffer
  leaves: Buffer[]
  tree: Buffer[][]
}

export async function buildTree(leaves: Buffer[]): Promise<MerkleTree> {
  if (leaves.length === 0) {
    throw new Error('Cannot build tree with empty leaves')
  }

  // Create a copy to avoid mutating the input
  const treeLeaves = [...leaves]

  // Pad to next power of 2 if necessary
  const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(treeLeaves.length)))
  while (treeLeaves.length < nextPowerOf2) {
    // Use zero buffer for padding
    treeLeaves.push(Buffer.alloc(32))
  }

  const tree: Buffer[][] = [treeLeaves]

  // Build the tree bottom-up
  for (let level = 0; level < Math.log2(treeLeaves.length); level++) {
    const currentLevel = tree[level]
    const nextLevel: Buffer[] = []

    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i]
      const right = currentLevel[i + 1]
      const parent = await hashNode(left, right)
      nextLevel.push(parent)
    }

    tree.push(nextLevel)

    if (nextLevel.length === 1) {
      break
    }
  }

  return {
    root: tree[tree.length - 1][0],
    leaves: tree[0],
    tree
  }
}

export async function getProof(tree: MerkleTree, index: number): Promise<MerkleProof | null> {
  if (index < 0 || index >= tree.leaves.length) {
    return null
  }

  const proof: Buffer[] = []
  const leaf = tree.leaves[index]
  let currentIndex = index

  // Traverse up the tree collecting sibling nodes
  for (let level = 0; level < tree.tree.length - 1; level++) {
    const currentLevel = tree.tree[level]
    const isRightNode = currentIndex % 2 === 1
    const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1

    if (siblingIndex < currentLevel.length) {
      const sibling = currentLevel[siblingIndex]
      proof.push(sibling)
    }

    currentIndex = Math.floor(currentIndex / 2)
  }

  return {
    leaf,
    index,
    path: proof
  }
}

export async function verify(leaf: Buffer, proof: MerkleProof, root: Buffer): Promise<boolean> {
  let current = leaf

  for (const sibling of proof.path) {
    // Determine if current hash should be on left or right based on the path
    // Since we always sort in hashNode, we need to try both orders
    const leftHash = await hashNode(current, sibling)
    const rightHash = await hashNode(sibling, current)

    // Check which combination matches the expected pattern
    current = leftHash.equals(rightHash) ? leftHash : leftHash
  }

  return current.equals(root)
}