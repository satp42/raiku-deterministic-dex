# Fairlane DEX Coordinator Service

The batch coordination service that manages Raiku slot reservations and batch execution timing.

## Features

- **Environment Loading**: Loads configuration from environment variables
- **Database Connection**: Connects to Prisma database (same as web app)
- **Market Monitoring**: Loads and logs active markets with their batch statistics
- **Graceful Shutdown**: Handles SIGINT/SIGTERM signals properly
- **Error Handling**: Comprehensive error handling with logging

## Setup

1. **Install Dependencies**:
   ```bash
   cd services/coordinator
   npm install
   ```

2. **Environment Variables**:
   ```bash
   # Copy example and configure
   cp .env.example .env
   ```

   Required:
   ```env
   DATABASE_URL="file:../../apps/web/prisma/dev.db"  # Same DB as web app
   NODE_ENV="development"
   LOG_LEVEL="info"
   ```

3. **Build** (optional):
   ```bash
   npm run build
   ```

## Usage

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Testing
```bash
# Test coordinator functionality
tsx scripts/test-coordinator.ts

# Test full boot (blocks indefinitely)
tsx scripts/test-coordinator.ts --full
```

## What It Does

1. **Loads Environment**: Reads DATABASE_URL and other config
2. **Connects to Database**: Tests Prisma connection
3. **Logs Markets**: Displays all active markets with:
   - Market details (symbol, tokens, cadence, fees)
   - Order counts (total, planned, settled)
   - Next planned batches with slots and ETAs
4. **Starts Coordination Loop**: Placeholder for batch planning logic

## Output Example

```
🚀 Starting Fairlane DEX Coordinator...
   Environment: development
   Database: file:***:***@../apps/web/prisma/dev.db
   Log Level: info

✅ Database connection established

📊 Found 1 active markets:

   SOL-USDC
     Base: So111111...1112
     Quote: EPjFWdd5...TDt1v
     Cadence: 1s (60 batches/min)
     Orders: 5 total
     Planned: 3 upcoming
     Settled: 2 completed
     Fee: 0.10%

     Next batches:
       📋 Slot 12345 (ETA: 30s)
       📋 Slot 12347 (ETA: 32s)
       📋 Slot 12349 (ETA: 34s)

🔄 Starting coordination loop...
   Coordinator loop active (placeholder)
   Next steps: batch planner, inclusion publisher, batch executor

✅ Coordinator service started successfully
   Press Ctrl+C to stop
```

## Integration

The coordinator service is designed to work with:

- **Web App Database**: Uses same Prisma schema and database
- **Raiku Scheduler**: Will integrate with the Raiku slot reservation system
- **GraphQL API**: Provides backend coordination for the frontend

## Next Steps

Once running, the coordinator will be extended with:

1. **Batch Planner**: Uses Raiku SDK to reserve AOT slots
2. **Inclusion Publisher**: Publishes Merkle roots before slot execution
3. **Batch Executor**: Executes settlements at reserved slots
4. **Receipt Handler**: Processes Raiku receipts and updates database
