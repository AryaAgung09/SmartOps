-- Expand role enums before remapping legacy values.
ALTER TABLE `users`
  MODIFY `role` ENUM('ADMIN', 'EMPLOYEE', 'SUPERVISOR', 'HR', 'IT', 'MANAGER', 'STAFF', 'FINANCE', 'GENERAL_AFFAIR') NOT NULL DEFAULT 'EMPLOYEE';

ALTER TABLE `approvals`
  MODIFY `approverRole` ENUM('ADMIN', 'EMPLOYEE', 'SUPERVISOR', 'HR', 'IT', 'MANAGER', 'STAFF', 'FINANCE', 'GENERAL_AFFAIR') NULL;

ALTER TABLE `role_feature_access`
  MODIFY `role` ENUM('ADMIN', 'EMPLOYEE', 'SUPERVISOR', 'HR', 'IT', 'MANAGER', 'STAFF', 'FINANCE', 'GENERAL_AFFAIR') NOT NULL;

-- Consolidate feature access from legacy roles into STAFF.
INSERT INTO `role_feature_access` (`role`, `featureKey`, `enabled`, `createdAt`, `updatedAt`)
SELECT 'STAFF', `featureKey`, MAX(`enabled`), MIN(`createdAt`), MAX(`updatedAt`)
FROM `role_feature_access`
WHERE `role` IN ('EMPLOYEE', 'SUPERVISOR', 'MANAGER')
GROUP BY `featureKey`
ON DUPLICATE KEY UPDATE
  `enabled` = GREATEST(`enabled`, VALUES(`enabled`)),
  `updatedAt` = GREATEST(`updatedAt`, VALUES(`updatedAt`));

DELETE FROM `role_feature_access`
WHERE `role` IN ('EMPLOYEE', 'SUPERVISOR', 'MANAGER');

UPDATE `users`
SET `role` = 'STAFF'
WHERE `role` IN ('EMPLOYEE', 'SUPERVISOR', 'MANAGER');

UPDATE `approvals`
SET `approverRole` = 'STAFF'
WHERE `approverRole` IN ('EMPLOYEE', 'SUPERVISOR', 'MANAGER');

-- Finalize the role enum.
ALTER TABLE `users`
  MODIFY `role` ENUM('ADMIN', 'STAFF', 'HR', 'IT', 'FINANCE', 'GENERAL_AFFAIR') NOT NULL DEFAULT 'STAFF';

ALTER TABLE `approvals`
  MODIFY `approverRole` ENUM('ADMIN', 'STAFF', 'HR', 'IT', 'FINANCE', 'GENERAL_AFFAIR') NULL;

ALTER TABLE `role_feature_access`
  MODIFY `role` ENUM('ADMIN', 'STAFF', 'HR', 'IT', 'FINANCE', 'GENERAL_AFFAIR') NOT NULL;

-- Role-based approvals are not tied to a specific user until acted on.
ALTER TABLE `approvals`
  MODIFY `approverId` INTEGER NULL;

-- Document fulfillment for administrative requests.
ALTER TABLE `requests`
  ADD COLUMN `documentCategory` ENUM('CONTRACT', 'DECREE', 'CERTIFICATE', 'WARNING_LETTER', 'PERSONAL', 'POLICY', 'OTHER') NULL,
  ADD COLUMN `fulfilledFileName` VARCHAR(191) NULL,
  ADD COLUMN `fulfilledFilePath` VARCHAR(191) NULL,
  ADD COLUMN `fulfilledMimeType` VARCHAR(191) NULL,
  ADD COLUMN `fulfilledFileSize` INTEGER NULL,
  ADD COLUMN `fulfilledAt` DATETIME(3) NULL,
  ADD COLUMN `fulfilledById` INTEGER NULL;

CREATE INDEX `requests_fulfilledById_idx` ON `requests`(`fulfilledById`);

ALTER TABLE `requests`
  ADD CONSTRAINT `requests_fulfilledById_fkey`
  FOREIGN KEY (`fulfilledById`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
