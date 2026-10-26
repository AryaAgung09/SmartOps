-- AlterTable
ALTER TABLE `expenses` ADD COLUMN `payrollId` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `expenses_payrollId_key` ON `expenses`(`payrollId`);

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_payrollId_fkey` FOREIGN KEY (`payrollId`) REFERENCES `payrolls`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
