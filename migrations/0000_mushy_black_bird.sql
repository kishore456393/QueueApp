CREATE TABLE `detection_snapshots` (
	`id` varchar(36) NOT NULL,
	`video_id` varchar(36) NOT NULL,
	`timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`total_queues` int NOT NULL,
	`queue_counts` json NOT NULL,
	`total_people` int NOT NULL,
	`best_queue` int NOT NULL,
	`worst_queue` int NOT NULL,
	`recommendation` text NOT NULL,
	`frame_data` text,
	`detections` json,
	CONSTRAINT `detection_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `queue_zones` (
	`id` varchar(36) NOT NULL,
	`video_id` varchar(36) NOT NULL,
	`queue_number` int NOT NULL,
	`polygon_points` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `queue_zones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` varchar(36) NOT NULL,
	`language` varchar(50) NOT NULL DEFAULT 'en',
	`audio_enabled` boolean NOT NULL DEFAULT false,
	`audio_interval` int NOT NULL DEFAULT 30,
	`refresh_interval` int NOT NULL DEFAULT 2,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(255) NOT NULL,
	`password` text NOT NULL,
	`first_name` text,
	`last_name` text,
	`email` varchar(255),
	`role` varchar(50) NOT NULL DEFAULT 'viewer',
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `videos` (
	`id` varchar(36) NOT NULL,
	`filename` text NOT NULL,
	`filepath` text NOT NULL,
	`source_type` varchar(50) NOT NULL DEFAULT 'file',
	`stream_url` text,
	`uploaded_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `videos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `detection_snapshots` ADD CONSTRAINT `detection_snapshots_video_id_videos_id_fk` FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `queue_zones` ADD CONSTRAINT `queue_zones_video_id_videos_id_fk` FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON DELETE no action ON UPDATE no action;