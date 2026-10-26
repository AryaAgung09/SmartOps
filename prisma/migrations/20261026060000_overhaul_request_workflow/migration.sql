-- Expand the enum first so legacy rows can be remapped safely.
ALTER TABLE `requests`
  MODIFY `type` ENUM('LEAVE', 'EQUIPMENT', 'IT_SUPPORT', 'GENERAL', 'FACILITY', 'ADMINISTRATIVE', 'PROCUREMENT') NOT NULL;

-- Map legacy request types to the new administrative request type.
UPDATE `requests`
SET `type` = 'ADMINISTRATIVE'
WHERE `type` IN ('GENERAL', 'LEAVE');

ALTER TABLE `requests`
  MODIFY `type` ENUM('IT_SUPPORT', 'EQUIPMENT', 'FACILITY', 'ADMINISTRATIVE', 'PROCUREMENT') NOT NULL;

ALTER TABLE `requests`
  ADD COLUMN `currentStep` INTEGER NOT NULL DEFAULT 1;

ALTER TABLE `approvals`
  ADD COLUMN `stepOrder` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `approverRole` ENUM('ADMIN', 'EMPLOYEE', 'SUPERVISOR', 'HR', 'IT', 'MANAGER') NULL,
  ADD COLUMN `actedAt` DATETIME(3) NULL;

UPDATE `approvals`
SET `stepOrder` = `id`;

UPDATE `approvals` a
JOIN `users` u ON u.`id` = a.`approverId`
SET a.`approverRole` = u.`role`,
    a.`actedAt` = CASE
      WHEN a.`status` IN ('APPROVED', 'REJECTED') THEN a.`updatedAt`
      ELSE NULL
    END;

ALTER TABLE `approvals`
  MODIFY `stepOrder` INTEGER NOT NULL;

CREATE UNIQUE INDEX `approvals_requestId_stepOrder_key`
  ON `approvals`(`requestId`, `stepOrder`);

CREATE INDEX `approvals_approverId_status_idx`
  ON `approvals`(`approverId`, `status`);
