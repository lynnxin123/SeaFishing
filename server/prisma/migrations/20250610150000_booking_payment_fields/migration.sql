-- AlterTable
ALTER TABLE `bookings` ADD COLUMN `paid_at` DATETIME(3) NULL,
    ADD COLUMN `payment_reminded_at` DATETIME(3) NULL;
