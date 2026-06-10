-- CreateIndex
CREATE INDEX `bookings_status_created_at_idx` ON `bookings`(`status`, `created_at`);
