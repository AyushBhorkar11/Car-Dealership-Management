ALTER TABLE `users` ADD `approval_status` enum('PENDING','APPROVED','REJECTED') DEFAULT 'APPROVED' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `reset_token` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `reset_token_expiry` datetime;--> statement-breakpoint
CREATE INDEX `users_approval_status_idx` ON `users` (`approval_status`);