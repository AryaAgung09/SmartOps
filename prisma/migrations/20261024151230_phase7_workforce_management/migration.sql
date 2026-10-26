-- AlterTable
ALTER TABLE `attendance_corrections` MODIFY `requestedStatus` ENUM('PRESENT', 'LATE', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'WORK_FROM_HOME', 'HOLIDAY', 'WEEKEND', 'NOT_CLOCKED_IN', 'EARLY_CHECKOUT', 'OVERTIME') NULL;

-- AlterTable
ALTER TABLE `attendances` ADD COLUMN `breakMinutes` INTEGER NULL,
    ADD COLUMN `earlyCheckoutMinutes` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lateMinutes` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `overtimeMinutes` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `scheduledEnd` DATETIME(3) NULL,
    ADD COLUMN `scheduledStart` DATETIME(3) NULL,
    MODIFY `status` ENUM('PRESENT', 'LATE', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'WORK_FROM_HOME', 'HOLIDAY', 'WEEKEND', 'NOT_CLOCKED_IN', 'EARLY_CHECKOUT', 'OVERTIME') NOT NULL DEFAULT 'PRESENT';

-- AlterTable
ALTER TABLE `users` ADD COLUMN `shiftId` INTEGER NULL,
    ADD COLUMN `workScheduleId` INTEGER NULL;

-- CreateTable
CREATE TABLE `work_schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `breakMinutes` INTEGER NOT NULL DEFAULT 60,
    `gracePeriodMinutes` INTEGER NOT NULL DEFAULT 15,
    `workingDays` VARCHAR(191) NOT NULL DEFAULT '1,2,3,4,5',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `work_schedules_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shifts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `breakMinutes` INTEGER NOT NULL DEFAULT 60,
    `gracePeriodMinutes` INTEGER NOT NULL DEFAULT 15,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `shifts_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `holidays` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATE NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `holidays_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_workScheduleId_fkey` FOREIGN KEY (`workScheduleId`) REFERENCES `work_schedules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
