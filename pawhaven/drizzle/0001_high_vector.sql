CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`provider` text NOT NULL,
	`created_at` text NOT NULL,
	`last_seen` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `record_operations` (
	`record_id` text PRIMARY KEY NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`assigned_to` text DEFAULT '' NOT NULL,
	`payment_status` text DEFAULT 'unpaid' NOT NULL,
	`paid_amount` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE no action
);
