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

   Batch Planner Settings:
   ```env
   BATCH_LOOK_AHEAD=10        # Number of future batches to plan
   BATCH_PLAN_INTERVAL=1000   # Planning check interval (ms)
   CUTOFF_LEAD_MS=500        # Lead time before batch to stop accepting orders
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

# Test batch planner integration
tsx scripts/test-batch-planner.ts

# Test full boot (blocks indefinitely)
tsx scripts/test-coordinator.ts --full
```

## What It Does

1. **Loads Environment**: Reads DATABASE_URL and batch planning configuration
2. **Connects to Database**: Tests Prisma connection
3. **Logs Markets**: Displays all active markets with:
   - Market details (symbol, tokens, cadence, fees)
   - Order counts (total, planned, settled)
   - Next planned batches with slots and ETAs
4. **Starts Batch Planner**: Automatically reserves AOT slots via Raiku SDK
5. **Maintains Rolling Schedule**: Continuously plans future batches per market cadence

## Output Example

```
🚀 Starting Fairlane DEX Coordinator...
   Environment: development
   Database: file:***:***@../apps/web/prisma/dev.db
   Log Level: info
   Batch Look Ahead: 10 batches
   Batch Plan Interval: 1000ms
   Cutoff Lead: 500ms

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

🗓️  Starting Batch Planner...
   Look ahead: 10 batches
   Plan interval: 1000ms
   Cutoff lead: 500ms

📋 Planning batches for 1 markets

📊 SOL-USDC: 3 future batches, need 7 new

🎯 Planning SOL-USDC batch at 2025-10-27T10:30:35.000Z (slot 12351)
✅ SOL-USDC batch 12351 reserved (Raiku: aot_1234567890_abc123def)

🎯 Planning SOL-USDC batch at 2025-10-27T10:30:36.000Z (slot 12354)
✅ SOL-USDC batch 12354 reserved (Raiku: aot_1234567891_xyz456ghi)

...

✅ Coordinator service started successfully
   Batch planner active - reserving AOT slots
   Press Ctrl+C to stop
```

## Integration

The coordinator service is designed to work with:

- **Web App Database**: Uses same Prisma schema and database
- **Raiku Client & Scheduler**: Integrates with the Raiku SDK for AOT slot reservations
- **GraphQL API**: Provides backend coordination for the frontend
- **Batch Planning**: Maintains rolling PlannedBatch records for deterministic execution

## Next Steps

The coordinator now includes batch planning! Further extensions:

1. **Inclusion Publisher**: Publishes Merkle roots before slot execution
2. **Batch Executor**: Executes settlements at reserved slots
3. **Receipt Handler**: Processes Raiku receipts and updates database
4. **Order Assignment**: Routes incoming orders to appropriate planned batches
