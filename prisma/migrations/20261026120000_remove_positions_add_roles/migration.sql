-- Add functional roles.
ALTER TABLE `users`
  MODIFY `role` ENUM('ADMIN', 'STAFF', 'HR', 'IT', 'FINANCE', 'GENERAL_AFFAIR', 'MARKETING', 'SALES', 'LOGISTICS', 'OUTSOURCING') NOT NULL DEFAULT 'STAFF';

ALTER TABLE `approvals`
  MODIFY `approverRole` ENUM('ADMIN', 'STAFF', 'HR', 'IT', 'FINANCE', 'GENERAL_AFFAIR', 'MARKETING', 'SALES', 'LOGISTICS', 'OUTSOURCING') NULL;

ALTER TABLE `role_feature_access`
  MODIFY `role` ENUM('ADMIN', 'STAFF', 'HR', 'IT', 'FINANCE', 'GENERAL_AFFAIR', 'MARKETING', 'SALES', 'LOGISTICS', 'OUTSOURCING') NOT NULL;

-- Positions are replaced by the role field on users.
ALTER TABLE `users` DROP FOREIGN KEY `users_positionId_fkey`;
ALTER TABLE `users` DROP COLUMN `positionId`;
DROP TABLE `positions`;
