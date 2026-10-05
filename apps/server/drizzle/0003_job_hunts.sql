CREATE TABLE `job_hunts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`started_on` text NOT NULL,
	`ended_on` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `job_hunts_user_idx` ON `job_hunts` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `job_hunts_active_idx` ON `job_hunts` (`user_id`) WHERE "job_hunts"."ended_on" is null;--> statement-breakpoint
-- drizzle-kit omits ON DELETE for columns added with ALTER TABLE, so it is written by hand.
-- Existing jobs are moved into a hunt by HuntsService.adoptOrphanedJobs when the server starts.
ALTER TABLE `jobs` ADD `hunt_id` integer REFERENCES job_hunts(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `jobs_hunt_idx` ON `jobs` (`hunt_id`);