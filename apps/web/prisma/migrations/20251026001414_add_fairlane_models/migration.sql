-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wallet" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "baseMint" TEXT NOT NULL,
    "quoteMint" TEXT NOT NULL,
    "tickSize" DECIMAL NOT NULL,
    "cadenceSec" INTEGER NOT NULL,
    "feeBps" INTEGER NOT NULL,
    "minNotional" DECIMAL NOT NULL DEFAULT 1.0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlannedBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "eta" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "raikuResId" TEXT,
    "merkleRoot" TEXT,
    "inclusionTime" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlannedBatch_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "qty" DECIMAL NOT NULL,
    "limitPx" DECIMAL,
    "salt" TEXT NOT NULL,
    "commitment" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "plannedBatchId" TEXT,
    "merkleLeafIdx" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_plannedBatchId_fkey" FOREIGN KEY ("plannedBatchId") REFERENCES "PlannedBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "merkleRoot" TEXT NOT NULL,
    "clearingPx" DECIMAL NOT NULL,
    "totalBase" DECIMAL NOT NULL,
    "totalQuote" DECIMAL NOT NULL,
    "txSig" TEXT NOT NULL,
    "blockTime" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Batch_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Fill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "filledQty" DECIMAL NOT NULL,
    "avgFillPx" DECIMAL NOT NULL,
    "feePaid" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Fill_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Fill_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_wallet_key" ON "User"("wallet");

-- CreateIndex
CREATE INDEX "User_wallet_idx" ON "User"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "Market_symbol_key" ON "Market"("symbol");

-- CreateIndex
CREATE INDEX "Market_symbol_idx" ON "Market"("symbol");

-- CreateIndex
CREATE INDEX "Market_active_idx" ON "Market"("active");

-- CreateIndex
CREATE INDEX "PlannedBatch_marketId_status_idx" ON "PlannedBatch"("marketId", "status");

-- CreateIndex
CREATE INDEX "PlannedBatch_slot_idx" ON "PlannedBatch"("slot");

-- CreateIndex
CREATE INDEX "PlannedBatch_eta_idx" ON "PlannedBatch"("eta");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedBatch_marketId_slot_key" ON "PlannedBatch"("marketId", "slot");

-- CreateIndex
CREATE INDEX "Order_userId_status_idx" ON "Order"("userId", "status");

-- CreateIndex
CREATE INDEX "Order_marketId_status_idx" ON "Order"("marketId", "status");

-- CreateIndex
CREATE INDEX "Order_plannedBatchId_idx" ON "Order"("plannedBatchId");

-- CreateIndex
CREATE INDEX "Order_commitment_idx" ON "Order"("commitment");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_slot_key" ON "Batch"("slot");

-- CreateIndex
CREATE INDEX "Batch_marketId_idx" ON "Batch"("marketId");

-- CreateIndex
CREATE INDEX "Batch_slot_idx" ON "Batch"("slot");

-- CreateIndex
CREATE INDEX "Batch_blockTime_idx" ON "Batch"("blockTime");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_marketId_slot_key" ON "Batch"("marketId", "slot");

-- CreateIndex
CREATE INDEX "Fill_orderId_idx" ON "Fill"("orderId");

-- CreateIndex
CREATE INDEX "Fill_batchId_idx" ON "Fill"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "Fill_orderId_batchId_key" ON "Fill"("orderId", "batchId");
