-- AlterTable
ALTER TABLE `users` ADD COLUMN `contractEndDate` DATE NULL,
    ADD COLUMN `contractStartDate` DATE NULL,
    ADD COLUMN `contractType` ENUM('PERMANENT', 'FIXED_TERM', 'PROBATION', 'INTERNSHIP', 'FREELANCE') NULL;
