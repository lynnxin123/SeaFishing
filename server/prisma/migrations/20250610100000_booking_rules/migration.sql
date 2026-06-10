-- 海钓船预约规则：时段、库存、取消退款、爽约限制

-- 1. 扩展订单状态：爽约
ALTER TABLE `bookings` MODIFY `status` ENUM(
  'pending_pay',
  'pending_accept',
  'accepted',
  'departed',
  'completed',
  'cancelled',
  'no_show'
) NOT NULL DEFAULT 'pending_accept';

-- 2. 船型
ALTER TABLE `bookings` ADD COLUMN `booking_type` ENUM('shared', 'charter') NOT NULL DEFAULT 'shared' AFTER `status`;
ALTER TABLE `bookings` ADD COLUMN `sail_slot_id` VARCHAR(191) NULL AFTER `booking_type`;
ALTER TABLE `bookings` ADD COLUMN `slot_time` VARCHAR(16) NOT NULL DEFAULT '' AFTER `sail_slot_id`;
ALTER TABLE `bookings` ADD COLUMN `departure_at` DATETIME(3) NULL AFTER `slot_time`;
ALTER TABLE `bookings` ADD COLUMN `total_amount` DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `departure_at`;
ALTER TABLE `bookings` ADD COLUMN `refund_amount` DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `total_amount`;
ALTER TABLE `bookings` ADD COLUMN `refund_percent` INT NOT NULL DEFAULT 0 AFTER `refund_amount`;
ALTER TABLE `bookings` ADD COLUMN `cancelled_at` DATETIME(3) NULL AFTER `refund_percent`;
ALTER TABLE `bookings` ADD COLUMN `cancel_reason` VARCHAR(255) NOT NULL DEFAULT '' AFTER `cancelled_at`;
ALTER TABLE `bookings` ADD COLUMN `cancel_type` VARCHAR(32) NOT NULL DEFAULT '' AFTER `cancel_reason`;
ALTER TABLE `bookings` ADD COLUMN `no_show` BOOLEAN NOT NULL DEFAULT false AFTER `cancel_type`;
ALTER TABLE `bookings` ADD COLUMN `is_holiday` BOOLEAN NOT NULL DEFAULT false AFTER `no_show`;

CREATE INDEX `bookings_user_date_slot_idx` ON `bookings`(`user_id`, `date`, `slot_time`);
CREATE INDEX `bookings_boat_date_slot_idx` ON `bookings`(`boat_id`, `date`, `slot_time`);
CREATE INDEX `bookings_departure_at_idx` ON `bookings`(`departure_at`);

-- 3. 出航时段
CREATE TABLE `sail_slots` (
  `id` VARCHAR(191) NOT NULL,
  `slot_key` VARCHAR(64) NOT NULL,
  `slot_time` VARCHAR(16) NOT NULL,
  `label` VARCHAR(64) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `sail_slots_slot_key_key`(`slot_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. 船只时段配置（库存上限、价格）
CREATE TABLE `boat_sail_configs` (
  `id` VARCHAR(191) NOT NULL,
  `boat_id` VARCHAR(191) NOT NULL,
  `sail_slot_id` VARCHAR(191) NOT NULL,
  `max_people` INT NOT NULL DEFAULT 8,
  `max_orders` INT NOT NULL DEFAULT 10,
  `price_shared` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `price_charter` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `active` BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `boat_sail_configs_boat_slot_key`(`boat_id`, `sail_slot_id`),
  INDEX `boat_sail_configs_boat_id_idx`(`boat_id`),
  CONSTRAINT `boat_sail_configs_boat_id_fkey` FOREIGN KEY (`boat_id`) REFERENCES `boats`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `boat_sail_configs_sail_slot_id_fkey` FOREIGN KEY (`sail_slot_id`) REFERENCES `sail_slots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 5. 每日时段库存（并发扣减）
CREATE TABLE `slot_inventories` (
  `id` VARCHAR(191) NOT NULL,
  `boat_id` VARCHAR(191) NOT NULL,
  `sail_slot_id` VARCHAR(191) NOT NULL,
  `sail_date` VARCHAR(16) NOT NULL,
  `booked_people` INT NOT NULL DEFAULT 0,
  `booked_orders` INT NOT NULL DEFAULT 0,
  `is_holiday` BOOLEAN NOT NULL DEFAULT false,
  `maritime_blocked` BOOLEAN NOT NULL DEFAULT false,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `slot_inventories_boat_slot_date_key`(`boat_id`, `sail_slot_id`, `sail_date`),
  INDEX `slot_inventories_sail_date_idx`(`sail_date`),
  CONSTRAINT `slot_inventories_boat_id_fkey` FOREIGN KEY (`boat_id`) REFERENCES `boats`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `slot_inventories_sail_slot_id_fkey` FOREIGN KEY (`sail_slot_id`) REFERENCES `sail_slots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 6. 可配置规则
CREATE TABLE `booking_rule_configs` (
  `id` VARCHAR(191) NOT NULL DEFAULT 'default',
  `rules` JSON NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 7. 用户爽约统计
CREATE TABLE `user_booking_stats` (
  `user_id` VARCHAR(191) NOT NULL,
  `no_show_count` INT NOT NULL DEFAULT 0,
  `restricted_until` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `user_booking_stats_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `bookings`
  ADD CONSTRAINT `bookings_sail_slot_id_fkey` FOREIGN KEY (`sail_slot_id`) REFERENCES `sail_slots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
