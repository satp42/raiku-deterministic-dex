# Fairlane

**Deterministic batch auction DEX on Solana using Raiku**

## Overview

Fairlane eliminates MEV and transaction ordering unfairness through:
- **Batch auctions** with uniform clearing prices
- **Raiku AOT slot reservations** for deterministic execution
- **Merkle-based inclusion proofs** for transparency

## Architecture

```
fairlane/
├─ apps/
│  └─ web/          # Next.js frontend + GraphQL API
├─ services/
│  └─ coordinator/  # Batch scheduling & execution service
├─ contracts/
│  └─ fairlane_program/  # Anchor Solana program
└─ packages/
   ├─ types/        # Shared TypeScript types
   ├─ config/       # Market configuration
   └─ ui/           # Shared UI components
```

## Prerequisites

- Node.js >= 18
- pnpm >= 8
- PostgreSQL (or SQLite for dev)
- Solana CLI + Anchor (for contract development)

## Quick Start

```bash
# Install dependencies
pnpm install

# Development
pnpm dev
```

## Status

🚧 Under active development for hackathon

