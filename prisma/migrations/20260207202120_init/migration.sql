/*
  Warnings:

  - You are about to alter the column `initialBalance` on the `Account` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,2)`.
  - You are about to alter the column `planned` on the `Budget` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,2)`.
  - You are about to alter the column `totalAmount` on the `CardTransaction` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,2)`.
  - You are about to alter the column `amountThisInstallment` on the `CardTransaction` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,2)`.
  - You are about to alter the column `limit` on the `CreditCard` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,2)`.
  - You are about to alter the column `amount` on the `InvoicePayment` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,2)`.
  - You are about to alter the column `amount` on the `Transaction` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,2)`.
  - Added the required column `amount` to the `CardTransaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `CardTransaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Account" ALTER COLUMN "initialBalance" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Budget" ALTER COLUMN "planned" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "CardTransaction" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "amount" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "amountThisInstallment" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "CreditCard" ALTER COLUMN "limit" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "InvoicePayment" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);

-- CreateTable
CREATE TABLE "CardSubscription" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "creditCardId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categoryId" TEXT,
    "memberId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastGeneratedMonth" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardSubscription_householdId_creditCardId_idx" ON "CardSubscription"("householdId", "creditCardId");

-- CreateIndex
CREATE INDEX "CardSubscription_householdId_active_idx" ON "CardSubscription"("householdId", "active");

-- CreateIndex
CREATE INDEX "CardSubscription_householdId_dayOfMonth_idx" ON "CardSubscription"("householdId", "dayOfMonth");

-- CreateIndex
CREATE UNIQUE INDEX "CardSubscription_householdId_creditCardId_description_membe_key" ON "CardSubscription"("householdId", "creditCardId", "description", "memberId", "categoryId");

-- CreateIndex
CREATE INDEX "Budget_householdId_month_idx" ON "Budget"("householdId", "month");

-- CreateIndex
CREATE INDEX "Budget_categoryId_idx" ON "Budget"("categoryId");

-- CreateIndex
CREATE INDEX "CardTransaction_householdId_date_idx" ON "CardTransaction"("householdId", "date");

-- CreateIndex
CREATE INDEX "CardTransaction_creditCardId_statementMonth_idx" ON "CardTransaction"("creditCardId", "statementMonth");

-- CreateIndex
CREATE INDEX "CardTransaction_categoryId_idx" ON "CardTransaction"("categoryId");

-- CreateIndex
CREATE INDEX "CardTransaction_memberId_idx" ON "CardTransaction"("memberId");

-- CreateIndex
CREATE INDEX "CreditCard_householdId_active_idx" ON "CreditCard"("householdId", "active");

-- CreateIndex
CREATE INDEX "InvoicePayment_householdId_paidAt_idx" ON "InvoicePayment"("householdId", "paidAt");

-- CreateIndex
CREATE INDEX "InvoicePayment_creditCardId_statementMonth_idx" ON "InvoicePayment"("creditCardId", "statementMonth");

-- CreateIndex
CREATE INDEX "Transaction_householdId_date_idx" ON "Transaction"("householdId", "date");

-- CreateIndex
CREATE INDEX "Transaction_categoryId_idx" ON "Transaction"("categoryId");

-- CreateIndex
CREATE INDEX "Transaction_memberId_idx" ON "Transaction"("memberId");

-- AddForeignKey
ALTER TABLE "CardSubscription" ADD CONSTRAINT "CardSubscription_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardSubscription" ADD CONSTRAINT "CardSubscription_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardSubscription" ADD CONSTRAINT "CardSubscription_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardSubscription" ADD CONSTRAINT "CardSubscription_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "HouseholdMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
