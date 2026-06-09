-- Performance indexes (safe to run on existing data)

-- CreateIndex
CREATE INDEX `boats_active_score_idx` ON `boats`(`active`, `score`);
CREATE INDEX `boats_active_price_idx` ON `boats`(`active`, `price`);

-- CreateIndex
CREATE INDEX `bookings_user_id_created_at_idx` ON `bookings`(`user_id`, `created_at`);

-- CreateIndex
CREATE INDEX `fishing_spots_active_idx` ON `fishing_spots`(`active`);

-- CreateIndex
CREATE INDEX `spot_boat_links_boat_id_idx` ON `spot_boat_links`(`boat_id`);

-- CreateIndex
CREATE INDEX `map_favorites_user_id_idx` ON `map_favorites`(`user_id`);

-- CreateIndex
CREATE INDEX `competitions_active_legacy_id_idx` ON `competitions`(`active`, `legacy_id`);

-- CreateIndex
CREATE UNIQUE INDEX `competition_registrations_competition_id_user_id_key` ON `competition_registrations`(`competition_id`, `user_id`);

-- CreateIndex
CREATE INDEX `boat_reviews_boat_id_created_at_idx` ON `boat_reviews`(`boat_id`, `created_at`);

-- CreateIndex
CREATE INDEX `reward_logs_user_id_type_created_at_idx` ON `reward_logs`(`user_id`, `type`, `created_at`);

-- CreateIndex
CREATE INDEX `banners_active_sort_order_idx` ON `banners`(`active`, `sort_order`);
