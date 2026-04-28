CREATE INDEX `idx_comments_ticket_id` ON `comments` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `idx_ticket_labels_label_id` ON `ticket_labels` (`label_id`);--> statement-breakpoint
CREATE INDEX `idx_tickets_status` ON `tickets` (`status`);--> statement-breakpoint
CREATE INDEX `idx_tickets_assignee_id` ON `tickets` (`assignee_id`);--> statement-breakpoint
CREATE INDEX `idx_tickets_created_at` ON `tickets` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_tickets_is_archived` ON `tickets` (`is_archived`);