-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Bottle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "producer" TEXT,
    "vintage" INTEGER,
    "region" TEXT,
    "grapes" TEXT,
    "style" TEXT NOT NULL,
    "rating" REAL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "purchaseDate" DATETIME,
    "purchasePrice" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Bottle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BottleAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bottleId" TEXT NOT NULL,
    "readinessStatus" TEXT NOT NULL,
    "drinkFromYear" INTEGER,
    "drinkToYear" INTEGER,
    "decantMinutes" INTEGER,
    "serveTempC" REAL,
    "explanation" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BottleAnalysis_bottleId_fkey" FOREIGN KEY ("bottleId") REFERENCES "Bottle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OpenEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bottleId" TEXT NOT NULL,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mealType" TEXT,
    "occasion" TEXT,
    "vibe" TEXT,
    "constraintsJson" TEXT,
    "userRating" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpenEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OpenEvent_bottleId_fkey" FOREIGN KEY ("bottleId") REFERENCES "Bottle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Bottle_userId_idx" ON "Bottle"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BottleAnalysis_bottleId_key" ON "BottleAnalysis"("bottleId");

-- CreateIndex
CREATE INDEX "BottleAnalysis_bottleId_idx" ON "BottleAnalysis"("bottleId");

-- CreateIndex
CREATE INDEX "OpenEvent_userId_idx" ON "OpenEvent"("userId");

-- CreateIndex
CREATE INDEX "OpenEvent_bottleId_idx" ON "OpenEvent"("bottleId");

-- CreateIndex
CREATE INDEX "OpenEvent_openedAt_idx" ON "OpenEvent"("openedAt");
