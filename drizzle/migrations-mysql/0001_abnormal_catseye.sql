ALTER TABLE `enquiries` MODIFY COLUMN `remarks` text;--> statement-breakpoint
ALTER TABLE `enquiries` MODIFY COLUMN `test_drive_feedback` text;--> statement-breakpoint
ALTER TABLE `login_events` MODIFY COLUMN `user_agent` text;--> statement-breakpoint
ALTER TABLE `payments` MODIFY COLUMN `remarks` text;--> statement-breakpoint
ALTER TABLE `purchases` MODIFY COLUMN `rejection_reason` text;--> statement-breakpoint
ALTER TABLE `quotations` MODIFY COLUMN `discount_remarks` text;--> statement-breakpoint
ALTER TABLE `services` MODIFY COLUMN `description` text;