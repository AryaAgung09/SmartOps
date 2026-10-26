-- Employee records may exist without a login account.
-- Accounts are activated later by an Admin.
ALTER TABLE `users` MODIFY `email` VARCHAR(191) NULL,
    MODIFY `passwordHash` VARCHAR(191) NULL;
