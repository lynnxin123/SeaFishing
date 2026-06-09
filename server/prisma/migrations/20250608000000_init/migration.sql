-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `openid` VARCHAR(191) NOT NULL,
    `nick_name` VARCHAR(191) NOT NULL DEFAULT '微信用户',
    `avatar_url` VARCHAR(191) NOT NULL DEFAULT '',
    `phone` VARCHAR(191) NOT NULL DEFAULT '',
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `real_name` VARCHAR(191) NOT NULL DEFAULT '',
    `id_type` VARCHAR(191) NOT NULL DEFAULT '身份证',
    `id_number` VARCHAR(191) NOT NULL DEFAULT '',
    `level_name` VARCHAR(191) NOT NULL DEFAULT '青铜钓手',
    `medals` INTEGER NOT NULL DEFAULT 0,
    `points` INTEGER NOT NULL DEFAULT 0,
    `fish_food` INTEGER NOT NULL DEFAULT 5,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_openid_key`(`openid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `boats` (
    `id` VARCHAR(191) NOT NULL,
    `boat_id` VARCHAR(191) NOT NULL,
    `ship_name` VARCHAR(191) NOT NULL,
    `max_num` INTEGER NOT NULL DEFAULT 8,
    `ship_len` DOUBLE NULL,
    `ship_wid` DOUBLE NULL,
    `score` DOUBLE NOT NULL DEFAULT 4.5,
    `sail_count` INTEGER NOT NULL DEFAULT 0,
    `experience` INTEGER NOT NULL DEFAULT 5,
    `captain` VARCHAR(191) NOT NULL DEFAULT '',
    `captain_avatar` VARCHAR(191) NOT NULL DEFAULT '/images/captain.jpg',
    `price` DOUBLE NOT NULL DEFAULT 0,
    `wharf` VARCHAR(191) NOT NULL DEFAULT '大连码头',
    `display_wharf` VARCHAR(191) NOT NULL DEFAULT '大连码头',
    `facilities` JSON NOT NULL,
    `images` JSON NOT NULL,
    `description` TEXT NOT NULL,
    `contact` VARCHAR(191) NOT NULL DEFAULT '',
    `built_year` INTEGER NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `boats_boat_id_key`(`boat_id`),
    INDEX `boats_wharf_idx`(`wharf`),
    INDEX `boats_active_idx`(`active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bookings` (
    `id` VARCHAR(191) NOT NULL,
    `order_no` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `boat_id` VARCHAR(191) NULL,
    `ship_name` VARCHAR(191) NOT NULL,
    `cover_image` VARCHAR(191) NOT NULL DEFAULT '/images/boat1.jpg',
    `price` VARCHAR(191) NOT NULL DEFAULT '',
    `wharf` VARCHAR(191) NOT NULL DEFAULT '',
    `depart_wharf` VARCHAR(191) NOT NULL DEFAULT '',
    `date` VARCHAR(191) NOT NULL,
    `people` INTEGER NOT NULL DEFAULT 1,
    `captain_name` VARCHAR(191) NOT NULL DEFAULT '',
    `status` ENUM('pending_pay', 'pending_accept', 'accepted', 'departed', 'completed', 'cancelled') NOT NULL DEFAULT 'pending_accept',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bookings_order_no_key`(`order_no`),
    INDEX `bookings_user_id_status_idx`(`user_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fishing_spots` (
    `id` VARCHAR(191) NOT NULL,
    `spot_key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `depth` VARCHAR(191) NOT NULL DEFAULT '',
    `fish_species` JSON NOT NULL,
    `best_months` VARCHAR(191) NOT NULL DEFAULT '',
    `charge_type` VARCHAR(191) NOT NULL DEFAULT 'paid',
    `price_note` VARCHAR(191) NOT NULL DEFAULT '',
    `sea_range` VARCHAR(191) NOT NULL DEFAULT 'near',
    `wind_sensitive` BOOLEAN NOT NULL DEFAULT false,
    `event_id` INTEGER NULL,
    `event_title` VARCHAR(191) NOT NULL DEFAULT '',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `fishing_spots_spot_key_key`(`spot_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `spot_boat_links` (
    `spot_id` VARCHAR(191) NOT NULL,
    `boat_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`spot_id`, `boat_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `map_favorites` (
    `user_id` VARCHAR(191) NOT NULL,
    `spot_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`user_id`, `spot_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `competitions` (
    `id` VARCHAR(191) NOT NULL,
    `legacy_id` INTEGER NOT NULL,
    `en_label` VARCHAR(191) NOT NULL DEFAULT 'COMPETITION FOR SEA',
    `name` VARCHAR(191) NOT NULL,
    `cover` VARCHAR(191) NOT NULL DEFAULT '',
    `status` ENUM('draft', 'upcoming', 'registering', 'ended') NOT NULL DEFAULT 'upcoming',
    `status_text` VARCHAR(191) NOT NULL DEFAULT '即将开赛',
    `location` VARCHAR(191) NOT NULL DEFAULT '',
    `time` VARCHAR(191) NOT NULL DEFAULT '',
    `fee` VARCHAR(191) NOT NULL DEFAULT '待定',
    `summary` TEXT NOT NULL,
    `intro` TEXT NOT NULL,
    `rules` JSON NOT NULL,
    `prizes` TEXT NOT NULL,
    `organizer` VARCHAR(191) NOT NULL DEFAULT '海发海岛海钓',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `competitions_legacy_id_key`(`legacy_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `competition_registrations` (
    `id` VARCHAR(191) NOT NULL,
    `competition_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `real_name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `people` INTEGER NOT NULL DEFAULT 1,
    `emergency_contact` VARCHAR(191) NOT NULL DEFAULT '',
    `remark` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `competition_registrations_competition_id_idx`(`competition_id`),
    INDEX `competition_registrations_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `banners` (
    `id` VARCHAR(191) NOT NULL,
    `image_url` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL DEFAULT '',
    `subtitle` VARCHAR(191) NOT NULL DEFAULT '',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_boat_id_fkey` FOREIGN KEY (`boat_id`) REFERENCES `boats`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `spot_boat_links` ADD CONSTRAINT `spot_boat_links_spot_id_fkey` FOREIGN KEY (`spot_id`) REFERENCES `fishing_spots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `spot_boat_links` ADD CONSTRAINT `spot_boat_links_boat_id_fkey` FOREIGN KEY (`boat_id`) REFERENCES `boats`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `map_favorites` ADD CONSTRAINT `map_favorites_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `map_favorites` ADD CONSTRAINT `map_favorites_spot_id_fkey` FOREIGN KEY (`spot_id`) REFERENCES `fishing_spots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `competition_registrations` ADD CONSTRAINT `competition_registrations_competition_id_fkey` FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `competition_registrations` ADD CONSTRAINT `competition_registrations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
