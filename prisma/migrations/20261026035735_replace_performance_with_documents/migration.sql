-- DropForeignKey
ALTER TABLE `performance_goals` DROP FOREIGN KEY `performance_goals_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `performance_goals` DROP FOREIGN KEY `performance_goals_periodId_fkey`;

-- DropForeignKey
ALTER TABLE `performance_goals` DROP FOREIGN KEY `performance_goals_userId_fkey`;

-- DropForeignKey
ALTER TABLE `performance_periods` DROP FOREIGN KEY `performance_periods_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `performance_review_items` DROP FOREIGN KEY `performance_review_items_reviewId_fkey`;

-- DropForeignKey
ALTER TABLE `performance_reviews` DROP FOREIGN KEY `performance_reviews_employeeId_fkey`;

-- DropForeignKey
ALTER TABLE `performance_reviews` DROP FOREIGN KEY `performance_reviews_periodId_fkey`;

-- DropForeignKey
ALTER TABLE `performance_reviews` DROP FOREIGN KEY `performance_reviews_reviewerId_fkey`;

-- DropTable
DROP TABLE `performance_goals`;

-- DropTable
DROP TABLE `performance_periods`;

-- DropTable
DROP TABLE `performance_review_items`;

-- DropTable
DROP TABLE `performance_reviews`;

-- CreateTable
CREATE TABLE `employee_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `category` ENUM('CONTRACT', 'DECREE', 'CERTIFICATE', 'WARNING_LETTER', 'PERSONAL', 'POLICY', 'OTHER') NOT NULL,
    `ownerId` INTEGER NULL,
    `uploadedById` INTEGER NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `issueDate` DATE NULL,
    `expiryDate` DATE NULL,
    `visibility` ENUM('HR_ONLY', 'EMPLOYEE') NOT NULL DEFAULT 'HR_ONLY',
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `employee_documents_ownerId_idx`(`ownerId`),
    INDEX `employee_documents_expiryDate_idx`(`expiryDate`),
    INDEX `employee_documents_category_archived_idx`(`category`, `archived`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `employee_documents` ADD CONSTRAINT `employee_documents_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_documents` ADD CONSTRAINT `employee_documents_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
