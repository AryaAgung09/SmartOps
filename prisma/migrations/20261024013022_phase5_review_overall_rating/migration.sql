/*
  Warnings:

  - You are about to alter the column `overallRating` on the `performance_reviews` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal(3,2)`.

*/
-- AlterTable
ALTER TABLE `performance_reviews` MODIFY `overallRating` DECIMAL(3, 2) NULL;
