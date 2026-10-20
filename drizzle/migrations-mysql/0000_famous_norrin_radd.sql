CREATE TABLE `accessories_catalogue` (
	`id` char(36) NOT NULL,
	`item_name` varchar(255) NOT NULL,
	`brand` varchar(100) NOT NULL DEFAULT '',
	`price` decimal(14,2) NOT NULL,
	`category` varchar(100) NOT NULL DEFAULT 'General',
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `accessories_catalogue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`role` varchar(50) NOT NULL,
	`branch_id` char(36),
	`action` varchar(100) NOT NULL,
	`entity` varchar(100) NOT NULL,
	`entity_id` varchar(100) NOT NULL,
	`old_value` json,
	`new_value` json,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `branches` (
	`id` char(36) NOT NULL,
	`branch_name` varchar(255) NOT NULL,
	`address` text NOT NULL,
	`city` varchar(100) NOT NULL,
	`phone` varchar(50) NOT NULL DEFAULT '',
	`demand_threshold` int NOT NULL DEFAULT 3,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `branches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cars` (
	`id` char(36) NOT NULL,
	`brand` varchar(100) NOT NULL,
	`model` varchar(100) NOT NULL,
	`variant` varchar(100) NOT NULL DEFAULT '',
	`fuel_type` varchar(50) NOT NULL DEFAULT 'Petrol',
	`transmission` varchar(50) NOT NULL DEFAULT 'Automatic',
	`color` varchar(50) NOT NULL DEFAULT '',
	`manufacturing_year` int NOT NULL DEFAULT 2026,
	`price` decimal(14,2) NOT NULL,
	`vin_chassis_no` varchar(100) NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'Available',
	`inventory_status` enum('IN_TRANSIT','IN_STOCK','RESERVED','SOLD','DELIVERED') NOT NULL DEFAULT 'IN_STOCK',
	`branch_id` char(36),
	`transfer_to` char(36),
	`image_key` varchar(100) NOT NULL DEFAULT 'sedan',
	`allocated_enquiry_id` char(36),
	`stock_arrival_date` date,
	`is_demo` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `cars_id` PRIMARY KEY(`id`),
	CONSTRAINT `cars_vin_unique` UNIQUE(`vin_chassis_no`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`phone` varchar(50) NOT NULL DEFAULT '',
	`email` varchar(255) NOT NULL DEFAULT '',
	`address` text NOT NULL,
	`city` varchar(100) NOT NULL DEFAULT '',
	`id_proof_type` varchar(50) NOT NULL DEFAULT '',
	`id_proof_number` varchar(100) NOT NULL DEFAULT '',
	`user_id` char(36),
	`auth_user_id` varchar(255),
	`is_demo` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`phone` varchar(50) NOT NULL DEFAULT '',
	`email` varchar(255) NOT NULL DEFAULT '',
	`branch_id` char(36),
	`user_id` char(36),
	`auth_user_id` varchar(255),
	`monthly_target` int NOT NULL DEFAULT 5,
	`is_active` boolean NOT NULL DEFAULT true,
	`is_demo` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `employees_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `enquiries` (
	`id` char(36) NOT NULL,
	`customer_id` char(36) NOT NULL,
	`employee_id` char(36),
	`car_id` char(36),
	`branch_id` char(36) NOT NULL,
	`enquiry_type` varchar(100) NOT NULL DEFAULT 'Car Enquiry',
	`enquiry_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`appointment_date` datetime,
	`status` varchar(50) NOT NULL DEFAULT 'New',
	`enquiry_stage` enum('NEW','CONTACTED','TEST_DRIVE','QUOTED','BOOKED','CLOSED_WON','CLOSED_LOST') NOT NULL DEFAULT 'NEW',
	`remarks` text NOT NULL,
	`requested_brand` varchar(100) NOT NULL DEFAULT '',
	`requested_model` varchar(100) NOT NULL DEFAULT '',
	`requested_variant` varchar(100) NOT NULL DEFAULT '',
	`preferred_color` varchar(50) NOT NULL DEFAULT '',
	`preferred_budget` decimal(14,2),
	`expected_timeline` varchar(100) NOT NULL DEFAULT '',
	`follow_up_date` datetime,
	`test_drive_feedback` text NOT NULL,
	`test_drive_car_id` char(36),
	`test_drive_slot` varchar(100) NOT NULL DEFAULT '',
	`quotation_id` char(36),
	`booking_amount` decimal(14,2) NOT NULL DEFAULT '0',
	`procurement_decision` varchar(50) NOT NULL DEFAULT 'Pending',
	`decision_by` char(36),
	`decision_at` datetime,
	`is_demo` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `enquiries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `login_events` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`role` varchar(50) NOT NULL,
	`branch_id` char(36),
	`event_type` varchar(50) NOT NULL,
	`ip` varchar(100) NOT NULL DEFAULT '',
	`user_agent` text NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `login_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` char(36) NOT NULL,
	`receipt_no` varchar(100) NOT NULL,
	`sale_id` char(36),
	`enquiry_id` char(36),
	`customer_id` char(36) NOT NULL,
	`branch_id` char(36) NOT NULL,
	`recorded_by` char(36) NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`payment_type` varchar(50) NOT NULL,
	`payment_method` varchar(50) NOT NULL,
	`payment_status` enum('PENDING','PARTIAL','PAID','REFUNDED') NOT NULL DEFAULT 'PAID',
	`transaction_reference` varchar(100) NOT NULL DEFAULT '',
	`remarks` text NOT NULL,
	`payment_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_receipt_no_unique` UNIQUE(`receipt_no`)
);
--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` char(36) NOT NULL,
	`supplier_id` char(36) NOT NULL,
	`car_id` char(36) NOT NULL,
	`employee_id` char(36) NOT NULL,
	`branch_id` char(36) NOT NULL,
	`enquiry_id` char(36),
	`purchase_date` date NOT NULL,
	`purchase_cost` decimal(14,2) NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'Pending Approval',
	`procurement_stage` enum('REQUESTED','MANAGER_APPROVED','OWNER_APPROVED','ORDERED','IN_TRANSIT','RECEIVED','ALLOCATED') NOT NULL DEFAULT 'REQUESTED',
	`expected_delivery_date` date,
	`manager_approved_by` char(36),
	`manager_approved_at` datetime,
	`owner_approved_by` char(36),
	`owner_approved_at` datetime,
	`rejection_reason` text NOT NULL,
	`is_demo` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `purchases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotations` (
	`id` char(36) NOT NULL,
	`quotation_number` varchar(100) NOT NULL,
	`customer_id` char(36) NOT NULL,
	`employee_id` char(36) NOT NULL,
	`branch_id` char(36) NOT NULL,
	`car_id` char(36),
	`brand` varchar(100) NOT NULL,
	`model` varchar(100) NOT NULL,
	`variant` varchar(100) NOT NULL,
	`color` varchar(50) NOT NULL DEFAULT '',
	`ex_showroom_price` decimal(14,2) NOT NULL,
	`gst_rate` decimal(5,2) NOT NULL DEFAULT '28.00',
	`gst_amount` decimal(14,2) NOT NULL DEFAULT '0',
	`insurance_amount` decimal(14,2) NOT NULL DEFAULT '0',
	`rto_tax` decimal(14,2) NOT NULL DEFAULT '0',
	`accessories_amount` decimal(14,2) NOT NULL DEFAULT '0',
	`discount_amount` decimal(14,2) NOT NULL DEFAULT '0',
	`max_allowed_discount` decimal(14,2) NOT NULL DEFAULT '25000',
	`discount_approval_status` varchar(50) NOT NULL DEFAULT 'APPROVED',
	`discount_approved_by` char(36),
	`discount_remarks` text NOT NULL,
	`on_road_price` decimal(14,2) NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'DRAFT',
	`valid_until` date NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `quotations_id` PRIMARY KEY(`id`),
	CONSTRAINT `quotations_number_unique` UNIQUE(`quotation_number`)
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` char(36) NOT NULL,
	`customer_id` char(36) NOT NULL,
	`car_id` char(36) NOT NULL,
	`employee_id` char(36) NOT NULL,
	`branch_id` char(36) NOT NULL,
	`booking_enquiry_id` char(36),
	`sale_date` date NOT NULL,
	`sale_amount` decimal(14,2) NOT NULL,
	`sale_type` varchar(50) NOT NULL DEFAULT 'Enquiry-based',
	`status` varchar(50) NOT NULL DEFAULT 'Pending',
	`payment_method` varchar(50),
	`amount_paid` decimal(14,2) NOT NULL DEFAULT '0',
	`payment_status` varchar(50),
	`registration_status` varchar(50) NOT NULL DEFAULT 'PENDING',
	`rto_number` varchar(100) NOT NULL DEFAULT '',
	`insurance_policy_number` varchar(100) NOT NULL DEFAULT '',
	`documents_verified` boolean NOT NULL DEFAULT false,
	`handover_date` date,
	`delivery_status` varchar(50) NOT NULL DEFAULT 'SCHEDULED',
	`is_demo` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `sales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` char(36) NOT NULL,
	`car_id` char(36) NOT NULL,
	`customer_id` char(36) NOT NULL,
	`employee_id` char(36) NOT NULL,
	`branch_id` char(36) NOT NULL,
	`service_date` date NOT NULL,
	`service_type` varchar(100) NOT NULL,
	`description` text NOT NULL,
	`cost` decimal(14,2) NOT NULL DEFAULT '0',
	`status` varchar(50) NOT NULL DEFAULT 'Scheduled',
	`is_demo` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` char(36) NOT NULL,
	`supplier_name` varchar(255) NOT NULL,
	`contact_person` varchar(255) NOT NULL DEFAULT '',
	`phone` varchar(50) NOT NULL DEFAULT '',
	`email` varchar(255) NOT NULL DEFAULT '',
	`address` text NOT NULL,
	`is_demo` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`app_role` enum('customer','employee','branch_manager','owner') NOT NULL DEFAULT 'customer',
	`branch_id` char(36),
	CONSTRAINT `user_roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` enum('OWNER','BRANCH_MANAGER','EMPLOYEE','CUSTOMER') NOT NULL DEFAULT 'EMPLOYEE',
	`branch_id` char(36),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`last_login_at` datetime,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cars` ADD CONSTRAINT `cars_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cars` ADD CONSTRAINT `cars_transfer_to_branches_id_fk` FOREIGN KEY (`transfer_to`) REFERENCES `branches`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employees` ADD CONSTRAINT `employees_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employees` ADD CONSTRAINT `employees_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enquiries` ADD CONSTRAINT `enquiries_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enquiries` ADD CONSTRAINT `enquiries_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enquiries` ADD CONSTRAINT `enquiries_car_id_cars_id_fk` FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enquiries` ADD CONSTRAINT `enquiries_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enquiries` ADD CONSTRAINT `enquiries_test_drive_car_id_cars_id_fk` FOREIGN KEY (`test_drive_car_id`) REFERENCES `cars`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enquiries` ADD CONSTRAINT `enquiries_decision_by_employees_id_fk` FOREIGN KEY (`decision_by`) REFERENCES `employees`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `login_events` ADD CONSTRAINT `login_events_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_sale_id_sales_id_fk` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_enquiry_id_enquiries_id_fk` FOREIGN KEY (`enquiry_id`) REFERENCES `enquiries`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_recorded_by_employees_id_fk` FOREIGN KEY (`recorded_by`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_car_id_cars_id_fk` FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_enquiry_id_enquiries_id_fk` FOREIGN KEY (`enquiry_id`) REFERENCES `enquiries`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_manager_approved_by_employees_id_fk` FOREIGN KEY (`manager_approved_by`) REFERENCES `employees`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_car_id_cars_id_fk` FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_discount_approved_by_employees_id_fk` FOREIGN KEY (`discount_approved_by`) REFERENCES `employees`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_car_id_cars_id_fk` FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_booking_enquiry_id_enquiries_id_fk` FOREIGN KEY (`booking_enquiry_id`) REFERENCES `enquiries`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_car_id_cars_id_fk` FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `accessories_category_idx` ON `accessories_catalogue` (`category`);--> statement-breakpoint
CREATE INDEX `accessories_status_idx` ON `accessories_catalogue` (`is_active`);--> statement-breakpoint
CREATE INDEX `audit_logs_user_idx` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_branch_idx` ON `audit_logs` (`branch_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entity`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `branches_city_idx` ON `branches` (`city`);--> statement-breakpoint
CREATE INDEX `branches_created_at_idx` ON `branches` (`created_at`);--> statement-breakpoint
CREATE INDEX `cars_branch_idx` ON `cars` (`branch_id`);--> statement-breakpoint
CREATE INDEX `cars_status_idx` ON `cars` (`status`);--> statement-breakpoint
CREATE INDEX `cars_inventory_status_idx` ON `cars` (`inventory_status`);--> statement-breakpoint
CREATE INDEX `cars_created_at_idx` ON `cars` (`created_at`);--> statement-breakpoint
CREATE INDEX `customers_city_idx` ON `customers` (`city`);--> statement-breakpoint
CREATE INDEX `customers_phone_idx` ON `customers` (`phone`);--> statement-breakpoint
CREATE INDEX `customers_user_idx` ON `customers` (`user_id`);--> statement-breakpoint
CREATE INDEX `customers_created_at_idx` ON `customers` (`created_at`);--> statement-breakpoint
CREATE INDEX `employees_branch_idx` ON `employees` (`branch_id`);--> statement-breakpoint
CREATE INDEX `employees_user_idx` ON `employees` (`user_id`);--> statement-breakpoint
CREATE INDEX `employees_status_idx` ON `employees` (`is_active`);--> statement-breakpoint
CREATE INDEX `enquiries_customer_idx` ON `enquiries` (`customer_id`);--> statement-breakpoint
CREATE INDEX `enquiries_branch_idx` ON `enquiries` (`branch_id`);--> statement-breakpoint
CREATE INDEX `enquiries_employee_idx` ON `enquiries` (`employee_id`);--> statement-breakpoint
CREATE INDEX `enquiries_stage_idx` ON `enquiries` (`enquiry_stage`);--> statement-breakpoint
CREATE INDEX `enquiries_created_at_idx` ON `enquiries` (`created_at`);--> statement-breakpoint
CREATE INDEX `login_events_user_idx` ON `login_events` (`user_id`);--> statement-breakpoint
CREATE INDEX `login_events_branch_idx` ON `login_events` (`branch_id`);--> statement-breakpoint
CREATE INDEX `login_events_created_at_idx` ON `login_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `payments_sale_idx` ON `payments` (`sale_id`);--> statement-breakpoint
CREATE INDEX `payments_enquiry_idx` ON `payments` (`enquiry_id`);--> statement-breakpoint
CREATE INDEX `payments_customer_idx` ON `payments` (`customer_id`);--> statement-breakpoint
CREATE INDEX `payments_branch_idx` ON `payments` (`branch_id`);--> statement-breakpoint
CREATE INDEX `payments_status_idx` ON `payments` (`payment_status`);--> statement-breakpoint
CREATE INDEX `payments_created_at_idx` ON `payments` (`created_at`);--> statement-breakpoint
CREATE INDEX `purchases_supplier_idx` ON `purchases` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `purchases_branch_idx` ON `purchases` (`branch_id`);--> statement-breakpoint
CREATE INDEX `purchases_enquiry_idx` ON `purchases` (`enquiry_id`);--> statement-breakpoint
CREATE INDEX `purchases_car_idx` ON `purchases` (`car_id`);--> statement-breakpoint
CREATE INDEX `purchases_stage_idx` ON `purchases` (`procurement_stage`);--> statement-breakpoint
CREATE INDEX `purchases_created_at_idx` ON `purchases` (`created_at`);--> statement-breakpoint
CREATE INDEX `quotations_customer_idx` ON `quotations` (`customer_id`);--> statement-breakpoint
CREATE INDEX `quotations_branch_idx` ON `quotations` (`branch_id`);--> statement-breakpoint
CREATE INDEX `quotations_employee_idx` ON `quotations` (`employee_id`);--> statement-breakpoint
CREATE INDEX `quotations_created_at_idx` ON `quotations` (`created_at`);--> statement-breakpoint
CREATE INDEX `sales_customer_idx` ON `sales` (`customer_id`);--> statement-breakpoint
CREATE INDEX `sales_branch_idx` ON `sales` (`branch_id`);--> statement-breakpoint
CREATE INDEX `sales_employee_idx` ON `sales` (`employee_id`);--> statement-breakpoint
CREATE INDEX `sales_car_idx` ON `sales` (`car_id`);--> statement-breakpoint
CREATE INDEX `sales_status_idx` ON `sales` (`status`);--> statement-breakpoint
CREATE INDEX `sales_created_at_idx` ON `sales` (`created_at`);--> statement-breakpoint
CREATE INDEX `services_car_idx` ON `services` (`car_id`);--> statement-breakpoint
CREATE INDEX `services_customer_idx` ON `services` (`customer_id`);--> statement-breakpoint
CREATE INDEX `services_branch_idx` ON `services` (`branch_id`);--> statement-breakpoint
CREATE INDEX `services_status_idx` ON `services` (`status`);--> statement-breakpoint
CREATE INDEX `suppliers_created_at_idx` ON `suppliers` (`created_at`);--> statement-breakpoint
CREATE INDEX `user_roles_user_idx` ON `user_roles` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_roles_branch_idx` ON `user_roles` (`branch_id`);--> statement-breakpoint
CREATE INDEX `users_branch_idx` ON `users` (`branch_id`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);