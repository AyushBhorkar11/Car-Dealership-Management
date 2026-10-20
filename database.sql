-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: cdms
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `__drizzle_migrations`
--

DROP TABLE IF EXISTS `__drizzle_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `__drizzle_migrations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `hash` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `__drizzle_migrations`
--

LOCK TABLES `__drizzle_migrations` WRITE;
/*!40000 ALTER TABLE `__drizzle_migrations` DISABLE KEYS */;
INSERT INTO `__drizzle_migrations` VALUES (1,'3726d9b67b4f86a8f25372a39d02fa3127166cfc8200e937ea556c776e3e2596',1791959122933),(2,'4bf41817efb23b53d5280a642afa1f8ca4dce3ac8c2fcae934cb3fe069ab23b3',1791959380095);
/*!40000 ALTER TABLE `__drizzle_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accessories_catalogue`
--

DROP TABLE IF EXISTS `accessories_catalogue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accessories_catalogue` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `brand` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `price` decimal(14,2) NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'General',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `accessories_category_idx` (`category`),
  KEY `accessories_status_idx` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accessories_catalogue`
--

LOCK TABLES `accessories_catalogue` WRITE;
/*!40000 ALTER TABLE `accessories_catalogue` DISABLE KEYS */;
INSERT INTO `accessories_catalogue` VALUES ('01f856f4-d7ac-41c0-b02b-3af868fc97ba','7D All-Weather Floor Mats','OEM Premium',6500.00,'Interior',1,'2026-10-14 06:28:38'),('673004c2-a4a3-4d18-9301-bcbd10a3f178','Ceramic Coating Package (3 Years)','GrapheneShield',28000.00,'Exterior',1,'2026-10-14 06:28:38'),('85b25321-1b18-4610-bba0-9b4323ef88fc','Perforated Leatherette Seat Covers','ComfortLine',16500.00,'Interior',1,'2026-10-14 06:28:38'),('b60d65a3-77d9-46b0-8ecc-33032661cdc0','Dual-Channel HD Dashcam with GPS','SafeDrive',14500.00,'Electronics',1,'2026-10-14 06:28:38'),('e3332ed0-63c6-42fa-8dad-491cd143e9dd','Aerodynamic Roof Rails & Crossbars','AutoCross',12000.00,'Exterior',1,'2026-10-14 06:28:38');
/*!40000 ALTER TABLE `accessories_catalogue` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_value` json DEFAULT NULL,
  `new_value` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `audit_logs_user_idx` (`user_id`),
  KEY `audit_logs_branch_idx` (`branch_id`),
  KEY `audit_logs_entity_idx` (`entity`),
  KEY `audit_logs_created_at_idx` (`created_at`),
  CONSTRAINT `audit_logs_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES ('87464ba4-af01-4f7a-ae7e-7a9a30e8f942','c7069ea9-b9d0-41c1-a908-88e2217c3a5b','BRANCH_MANAGER','65101080-aa01-4ad4-8c3a-31ded9cf30e8','UPDATE_STAFF_PROFILE','employees','5ee5b739-ce22-4056-aaec-96a2a8faaebf',NULL,'{\"isActive\": true, \"employeeId\": \"5ee5b739-ce22-4056-aaec-96a2a8faaebf\", \"monthlyTarget\": 2}','2026-10-14 07:17:55');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `branches`
--

DROP TABLE IF EXISTS `branches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `branches` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `city` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `demand_threshold` int NOT NULL DEFAULT '3',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `branches_city_idx` (`city`),
  KEY `branches_created_at_idx` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `branches`
--

LOCK TABLES `branches` WRITE;
/*!40000 ALTER TABLE `branches` DISABLE KEYS */;
INSERT INTO `branches` VALUES ('15a28da8-6df2-4aeb-92a8-9ef1c14f3315','Pune Central Auto Hub','Plot 45, Senapati Bapat Road, Shivajinagar','Pune','+91 20 2567 8900',3,'2026-10-14 06:29:59'),('27ec6104-6948-4893-bc01-e101da21abea','Bengaluru Tech Corridor Hub','Outer Ring Road, Marathahalli','Bengaluru','+91 80 4123 7890',3,'2026-10-14 06:29:59'),('65101080-aa01-4ad4-8c3a-31ded9cf30e8','Mumbai South Showroom','12, Dr. Annie Besant Road, Worli','Mumbai','+91 22 2493 5000',3,'2026-10-14 06:29:59'),('81061b50-d9d0-4446-98be-21a69af3d8b3','Bengaluru Tech Corridor Hub','Outer Ring Road, Marathahalli','Bengaluru','+91 80 4123 7890',3,'2026-10-14 06:28:36'),('813e2cac-0f1b-4c0c-bd3d-cc2c19887e94','Mumbai South Showroom','12, Dr. Annie Besant Road, Worli','Mumbai','+91 22 2493 5000',3,'2026-10-14 06:28:36'),('a1888b5f-62a5-483c-90ce-b0029b820921','Pune Central Auto Hub','Plot 45, Senapati Bapat Road, Shivajinagar','Pune','+91 20 2567 8900',3,'2026-10-14 06:28:36');
/*!40000 ALTER TABLE `branches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cars`
--

DROP TABLE IF EXISTS `cars`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cars` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `brand` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `model` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variant` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `fuel_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Petrol',
  `transmission` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Automatic',
  `color` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `manufacturing_year` int NOT NULL DEFAULT '2026',
  `price` decimal(14,2) NOT NULL,
  `vin_chassis_no` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Available',
  `inventory_status` enum('IN_TRANSIT','IN_STOCK','RESERVED','SOLD','DELIVERED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'IN_STOCK',
  `branch_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `transfer_to` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `image_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'sedan',
  `allocated_enquiry_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stock_arrival_date` date DEFAULT NULL,
  `is_demo` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cars_vin_unique` (`vin_chassis_no`),
  KEY `cars_transfer_to_branches_id_fk` (`transfer_to`),
  KEY `cars_branch_idx` (`branch_id`),
  KEY `cars_status_idx` (`status`),
  KEY `cars_inventory_status_idx` (`inventory_status`),
  KEY `cars_created_at_idx` (`created_at`),
  CONSTRAINT `cars_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL,
  CONSTRAINT `cars_transfer_to_branches_id_fk` FOREIGN KEY (`transfer_to`) REFERENCES `branches` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cars`
--

LOCK TABLES `cars` WRITE;
/*!40000 ALTER TABLE `cars` DISABLE KEYS */;
INSERT INTO `cars` VALUES ('1d0ab08f-c764-4dac-99d7-fb764153f454','Toyota','Innova Hycross','ZX(O) Hybrid','Hybrid','Automatic','Blackish Ageha',2026,3098000.00,'MB9112233P0055441','Sold','SOLD','813e2cac-0f1b-4c0c-bd3d-cc2c19887e94',NULL,'mpv',NULL,'2026-07-01',1,'2026-10-14 06:28:38','2026-10-14 06:28:38'),('642f9ef8-934c-4a1c-af11-88a74b99e4a5','Mahindra','XUV700','AX7 L AWD Diesel','Diesel','Automatic','Midnight Black',2026,2699000.00,'MA1789230P0045612','Reserved','RESERVED','a1888b5f-62a5-483c-90ce-b0029b820921',NULL,'suv',NULL,'2026-09-20',1,'2026-10-14 06:28:38','2026-10-14 06:28:38'),('c0000de2-e3c0-438c-bdc4-e00a9876f9c1','Tata','Curvv EV','Accomplished Plus 55','Electric','Automatic','Pristine White',2026,2199000.00,'MAT998877P0012399','In Transit','IN_TRANSIT','81061b50-d9d0-4446-98be-21a69af3d8b3',NULL,'coupe',NULL,'2026-10-10',1,'2026-10-14 06:28:38','2026-10-14 06:28:38'),('cd5e5a6c-8359-47ca-ac8d-9bc03241ee6a','Tata','Nexon EV','Empowered Plus Long Range','Electric','Automatic','Intensi-Teal',2026,1929000.00,'MAT654129P0019281','Available','IN_STOCK','a1888b5f-62a5-483c-90ce-b0029b820921',NULL,'suv',NULL,'2026-09-15',1,'2026-10-14 06:28:38','2026-10-14 06:28:38'),('ff4b9080-617d-4045-a113-94c665e6b9a6','Hyundai','Creta','SX (O) 1.5 Turbo DCT','Petrol','Automatic','Titan Grey Matte',2026,2015000.00,'MAL543219P0088911','Available','IN_STOCK','813e2cac-0f1b-4c0c-bd3d-cc2c19887e94',NULL,'suv',NULL,'2026-08-10',1,'2026-10-14 06:28:38','2026-10-14 06:28:38');
/*!40000 ALTER TABLE `cars` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `address` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `city` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `id_proof_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `id_proof_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `auth_user_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_demo` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `customers_city_idx` (`city`),
  KEY `customers_phone_idx` (`phone`),
  KEY `customers_user_idx` (`user_id`),
  KEY `customers_created_at_idx` (`created_at`),
  CONSTRAINT `customers_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES ('14dfd96e-acd0-4736-8d70-8f64b5360103','Dr. Rahul Chitale','+91 98220 44551','rahul.chitale@example.com','B-402, Rohan Nilay, Aundh','Pune','Aadhaar Card','XXXX-XXXX-8921',NULL,NULL,1,'2026-10-14 06:28:38','2026-10-14 06:28:38'),('471e0735-d531-4a12-a979-c58b696d7f01','Aditya Nair','+91 98450 33211','aditya.nair@example.com','Villa 18, Palm Meadows, Whitefield','Bengaluru','Driving Licence','KA-03-2019-00912',NULL,NULL,1,'2026-10-14 06:28:38','2026-10-14 06:28:38'),('b7bab377-59e8-425d-9f1e-a5b4dd008f25','Priyanka Singhania','+91 98190 77123','priyanka.s@example.com','Flat 14A, Sea Face Towers, Worli','Mumbai','PAN Card','ABCPS8921K',NULL,NULL,1,'2026-10-14 06:28:38','2026-10-14 06:28:38'),('be033aa9-08e6-43c6-ac37-9057841906cb','Manoj Bajpai','+91 98211 99882','manoj.b@example.com','A-201, Marvel Bounty, Hadapsar','Pune','Aadhaar Card','XXXX-XXXX-4512',NULL,NULL,1,'2026-10-14 06:28:38','2026-10-14 06:28:38');
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employees`
--

DROP TABLE IF EXISTS `employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employees` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `branch_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `auth_user_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `monthly_target` int NOT NULL DEFAULT '5',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `is_demo` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employees_branch_idx` (`branch_id`),
  KEY `employees_user_idx` (`user_id`),
  KEY `employees_status_idx` (`is_active`),
  CONSTRAINT `employees_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `employees_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
INSERT INTO `employees` VALUES ('0f896714-7837-4ab5-80b2-2e4ef72fde96','Vikram Joshi','+91 98200 22001','manager.pune@cdms.local','15a28da8-6df2-4aeb-92a8-9ef1c14f3315','e8c03d9e-8943-4a9c-b16e-fefc8192de82',NULL,20,1,1,'2026-10-14 06:28:37','2026-10-14 06:28:37'),('5ee5b739-ce22-4056-aaec-96a2a8faaebf','Neha Patil','+91 98200 33001','employee.mumbai2@cdms.local','65101080-aa01-4ad4-8c3a-31ded9cf30e8','e13ff5ba-bbd8-4238-a136-de6b092cd304',NULL,2,1,1,'2026-10-14 06:28:37','2026-10-14 07:17:55'),('6aba7589-0230-46f5-a400-eee6d66aa0e3','Rohan Sawant','+91 98200 33001','employee.mumbai1@cdms.local','65101080-aa01-4ad4-8c3a-31ded9cf30e8','cb43efb0-904d-4957-aa8e-c2f7ec1bf51b',NULL,8,1,1,'2026-10-14 06:28:37','2026-10-14 06:28:37'),('987744e3-a671-4e5c-a538-ec9948143752','Kiran Rao','+91 98200 22001','manager.blr@cdms.local','27ec6104-6948-4893-bc01-e101da21abea','fbb85ad9-7120-4c9d-8d9a-9a2b24ab0bf5',NULL,20,1,1,'2026-10-14 06:28:37','2026-10-14 06:28:37'),('9ed17cca-843d-439e-8d0d-f671f2d2d5c6','Sameer Mehta','+91 98200 22001','manager.mumbai@cdms.local','65101080-aa01-4ad4-8c3a-31ded9cf30e8','c7069ea9-b9d0-41c1-a908-88e2217c3a5b',NULL,20,1,1,'2026-10-14 06:28:37','2026-10-14 06:28:37'),('b206adcb-1603-4c09-a743-ad25d80887ed','Rajesh Sharma','+91 98200 11001','owner@cdms.local',NULL,'77b1a359-b40d-42a8-968f-4f22a735f87e',NULL,0,1,1,'2026-10-14 06:28:37','2026-10-14 06:28:37'),('bd1365c7-8d04-493d-9d91-a3ae619cef5c','Ananya Hegde','+91 98200 33001','employee.blr2@cdms.local','27ec6104-6948-4893-bc01-e101da21abea','2906d4eb-ffbd-463a-97c3-179721e53612',NULL,8,1,1,'2026-10-14 06:28:38','2026-10-14 06:28:38'),('bfc38fbe-545a-4d43-af5e-bfb010cb9b67','Amit Kulkarni','+91 98200 33001','employee.pune1@cdms.local','15a28da8-6df2-4aeb-92a8-9ef1c14f3315','fcda3da5-5f74-47a9-9aa9-b53b1d93719c',NULL,8,1,1,'2026-10-14 06:28:37','2026-10-14 06:28:37'),('c952f8e4-73d2-487d-a230-d05fdbafc7a3','Karthik Gowda','+91 98200 33001','employee.blr1@cdms.local','27ec6104-6948-4893-bc01-e101da21abea','ea5cfeed-f402-4ba9-96ff-104cf16ef04b',NULL,8,1,1,'2026-10-14 06:28:38','2026-10-14 06:28:38'),('d3faa65b-ea0a-43ca-a1a6-9c7ac25cc0a9','Pooja Deshmukh','+91 98200 33001','employee.pune2@cdms.local','15a28da8-6df2-4aeb-92a8-9ef1c14f3315','dfebc276-8736-4a9b-a394-de96256a085a',NULL,8,1,1,'2026-10-14 06:28:37','2026-10-14 06:28:37');
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `enquiries`
--

DROP TABLE IF EXISTS `enquiries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `enquiries` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `employee_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `car_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `branch_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `enquiry_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Car Enquiry',
  `enquiry_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `appointment_date` datetime DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'New',
  `enquiry_stage` enum('NEW','CONTACTED','TEST_DRIVE','QUOTED','BOOKED','CLOSED_WON','CLOSED_LOST') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NEW',
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `requested_brand` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `requested_model` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `requested_variant` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `preferred_color` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `preferred_budget` decimal(14,2) DEFAULT NULL,
  `expected_timeline` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `follow_up_date` datetime DEFAULT NULL,
  `test_drive_feedback` text COLLATE utf8mb4_unicode_ci,
  `test_drive_car_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `test_drive_slot` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `quotation_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `booking_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `procurement_decision` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Pending',
  `decision_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `decision_at` datetime DEFAULT NULL,
  `is_demo` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `enquiries_car_id_cars_id_fk` (`car_id`),
  KEY `enquiries_test_drive_car_id_cars_id_fk` (`test_drive_car_id`),
  KEY `enquiries_decision_by_employees_id_fk` (`decision_by`),
  KEY `enquiries_customer_idx` (`customer_id`),
  KEY `enquiries_branch_idx` (`branch_id`),
  KEY `enquiries_employee_idx` (`employee_id`),
  KEY `enquiries_stage_idx` (`enquiry_stage`),
  KEY `enquiries_created_at_idx` (`created_at`),
  CONSTRAINT `enquiries_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `enquiries_car_id_cars_id_fk` FOREIGN KEY (`car_id`) REFERENCES `cars` (`id`) ON DELETE SET NULL,
  CONSTRAINT `enquiries_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `enquiries_decision_by_employees_id_fk` FOREIGN KEY (`decision_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  CONSTRAINT `enquiries_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  CONSTRAINT `enquiries_test_drive_car_id_cars_id_fk` FOREIGN KEY (`test_drive_car_id`) REFERENCES `cars` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `enquiries`
--

LOCK TABLES `enquiries` WRITE;
/*!40000 ALTER TABLE `enquiries` DISABLE KEYS */;
INSERT INTO `enquiries` VALUES ('106a5f8c-f3fc-40a3-9993-9ec78ce19f9a','14dfd96e-acd0-4736-8d70-8f64b5360103','bfc38fbe-545a-4d43-af5e-bfb010cb9b67','cd5e5a6c-8359-47ca-ac8d-9bc03241ee6a','a1888b5f-62a5-483c-90ce-b0029b820921','Test Drive','2026-10-14 11:58:37',NULL,'Scheduled','TEST_DRIVE','Interested in home test drive and charging setup details.','Tata','Nexon EV','Empowered Plus Long Range','Intensi-Teal',2000000.00,'Within 2 weeks',NULL,'Loved the instant acceleration and ventilated seats.','cd5e5a6c-8359-47ca-ac8d-9bc03241ee6a','2026-10-16 11:00 AM',NULL,0.00,'Pending',NULL,NULL,1,'2026-10-14 06:28:38','2026-10-14 06:28:38');
/*!40000 ALTER TABLE `enquiries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `login_events`
--

DROP TABLE IF EXISTS `login_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `login_events` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `event_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `login_events_user_idx` (`user_id`),
  KEY `login_events_branch_idx` (`branch_id`),
  KEY `login_events_created_at_idx` (`created_at`),
  CONSTRAINT `login_events_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `login_events`
--

LOCK TABLES `login_events` WRITE;
/*!40000 ALTER TABLE `login_events` DISABLE KEYS */;
INSERT INTO `login_events` VALUES ('2746f11e-2370-4996-a3da-d0da142e207b','77b1a359-b40d-42a8-968f-4f22a735f87e','OWNER',NULL,'LOGIN','127.0.0.1','[DEV QuickLogin] Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 07:42:39'),('2b8610b9-4c13-4c65-a8a4-7e89f5c02d7d','77b1a359-b40d-42a8-968f-4f22a735f87e','OWNER',NULL,'LOGIN','127.0.0.1','[DEV QuickLogin] Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 07:06:20'),('304c788f-f6a6-4e2e-af3c-02767d265d7e','77b1a359-b40d-42a8-968f-4f22a735f87e','OWNER',NULL,'LOGOUT','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 07:07:19'),('489a734c-8cc3-4f01-854a-b0481720b5c3','unknown','UNKNOWN',NULL,'FAILED_LOGIN','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 07:08:25'),('550ec432-50d2-4d0b-ba8b-12d6fae8e7af','77b1a359-b40d-42a8-968f-4f22a735f87e','OWNER',NULL,'LOGIN','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 06:58:13'),('55c6064c-09c4-4c45-892a-f5b4fb7e775e','2906d4eb-ffbd-463a-97c3-179721e53612','EMPLOYEE','27ec6104-6948-4893-bc01-e101da21abea','LOGIN','127.0.0.1','[DEV QuickLogin] Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 06:58:36'),('5fadf88c-3ace-48af-b143-823355fdb5c8','unknown','UNKNOWN',NULL,'FAILED_LOGIN','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 07:08:23'),('77c5c5bd-c1d3-4c82-89e7-ef9d419d61be','c7069ea9-b9d0-41c1-a908-88e2217c3a5b','BRANCH_MANAGER','65101080-aa01-4ad4-8c3a-31ded9cf30e8','LOGIN','127.0.0.1','[DEV QuickLogin] Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 07:16:22'),('78aba7d1-90f4-4784-bdb9-d010d98e363e','77b1a359-b40d-42a8-968f-4f22a735f87e','OWNER',NULL,'LOGIN','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 06:57:03'),('8b4cfa4d-c583-4f68-a303-c1abe2c109fb','unknown','UNKNOWN',NULL,'FAILED_LOGIN','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 07:08:24'),('b6a762d6-0c8d-4e43-83b5-e42d6d0d6fa0','unknown','UNKNOWN',NULL,'FAILED_LOGIN','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 07:08:14'),('bb68a03f-7aeb-4c97-9647-150fece0f7f3','2906d4eb-ffbd-463a-97c3-179721e53612','EMPLOYEE','27ec6104-6948-4893-bc01-e101da21abea','LOGIN','127.0.0.1','[DEV QuickLogin] Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 07:14:59'),('bd15f6d5-af74-4d7a-93d6-cfbfe40107c1','c7069ea9-b9d0-41c1-a908-88e2217c3a5b','BRANCH_MANAGER','65101080-aa01-4ad4-8c3a-31ded9cf30e8','LOGIN','127.0.0.1','[DEV QuickLogin] Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 07:28:05'),('c0227aa3-4d4b-403c-b55f-381f180037a9','unknown','UNKNOWN',NULL,'FAILED_LOGIN','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 07:08:24'),('db0f982c-a45b-4b22-8d7f-11feb91141c9','77b1a359-b40d-42a8-968f-4f22a735f87e','OWNER',NULL,'LOGIN','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 07:07:11');
/*!40000 ALTER TABLE `login_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `receipt_no` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sale_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `enquiry_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customer_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `recorded_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `payment_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_method` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_status` enum('PENDING','PARTIAL','PAID','REFUNDED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PAID',
  `transaction_reference` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `payment_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `payments_receipt_no_unique` (`receipt_no`),
  KEY `payments_recorded_by_employees_id_fk` (`recorded_by`),
  KEY `payments_sale_idx` (`sale_id`),
  KEY `payments_enquiry_idx` (`enquiry_id`),
  KEY `payments_customer_idx` (`customer_id`),
  KEY `payments_branch_idx` (`branch_id`),
  KEY `payments_status_idx` (`payment_status`),
  KEY `payments_created_at_idx` (`created_at`),
  CONSTRAINT `payments_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payments_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payments_enquiry_id_enquiries_id_fk` FOREIGN KEY (`enquiry_id`) REFERENCES `enquiries` (`id`) ON DELETE SET NULL,
  CONSTRAINT `payments_recorded_by_employees_id_fk` FOREIGN KEY (`recorded_by`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payments_sale_id_sales_id_fk` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchases`
--

DROP TABLE IF EXISTS `purchases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchases` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `supplier_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `car_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `employee_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `enquiry_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `purchase_date` date NOT NULL,
  `purchase_cost` decimal(14,2) NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Pending Approval',
  `procurement_stage` enum('REQUESTED','MANAGER_APPROVED','OWNER_APPROVED','ORDERED','IN_TRANSIT','RECEIVED','ALLOCATED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'REQUESTED',
  `expected_delivery_date` date DEFAULT NULL,
  `manager_approved_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `manager_approved_at` datetime DEFAULT NULL,
  `owner_approved_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `owner_approved_at` datetime DEFAULT NULL,
  `rejection_reason` text COLLATE utf8mb4_unicode_ci,
  `is_demo` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `purchases_employee_id_employees_id_fk` (`employee_id`),
  KEY `purchases_manager_approved_by_employees_id_fk` (`manager_approved_by`),
  KEY `purchases_supplier_idx` (`supplier_id`),
  KEY `purchases_branch_idx` (`branch_id`),
  KEY `purchases_enquiry_idx` (`enquiry_id`),
  KEY `purchases_car_idx` (`car_id`),
  KEY `purchases_stage_idx` (`procurement_stage`),
  KEY `purchases_created_at_idx` (`created_at`),
  CONSTRAINT `purchases_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `purchases_car_id_cars_id_fk` FOREIGN KEY (`car_id`) REFERENCES `cars` (`id`) ON DELETE CASCADE,
  CONSTRAINT `purchases_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `purchases_enquiry_id_enquiries_id_fk` FOREIGN KEY (`enquiry_id`) REFERENCES `enquiries` (`id`) ON DELETE SET NULL,
  CONSTRAINT `purchases_manager_approved_by_employees_id_fk` FOREIGN KEY (`manager_approved_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  CONSTRAINT `purchases_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchases`
--

LOCK TABLES `purchases` WRITE;
/*!40000 ALTER TABLE `purchases` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchases` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quotations`
--

DROP TABLE IF EXISTS `quotations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quotations` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quotation_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `employee_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `car_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `brand` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `model` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variant` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `ex_showroom_price` decimal(14,2) NOT NULL,
  `gst_rate` decimal(5,2) NOT NULL DEFAULT '28.00',
  `gst_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `insurance_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `rto_tax` decimal(14,2) NOT NULL DEFAULT '0.00',
  `accessories_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `discount_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `max_allowed_discount` decimal(14,2) NOT NULL DEFAULT '25000.00',
  `discount_approval_status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'APPROVED',
  `discount_approved_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `discount_remarks` text COLLATE utf8mb4_unicode_ci,
  `on_road_price` decimal(14,2) NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `valid_until` date NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `quotations_number_unique` (`quotation_number`),
  KEY `quotations_car_id_cars_id_fk` (`car_id`),
  KEY `quotations_discount_approved_by_employees_id_fk` (`discount_approved_by`),
  KEY `quotations_customer_idx` (`customer_id`),
  KEY `quotations_branch_idx` (`branch_id`),
  KEY `quotations_employee_idx` (`employee_id`),
  KEY `quotations_created_at_idx` (`created_at`),
  CONSTRAINT `quotations_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `quotations_car_id_cars_id_fk` FOREIGN KEY (`car_id`) REFERENCES `cars` (`id`) ON DELETE SET NULL,
  CONSTRAINT `quotations_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `quotations_discount_approved_by_employees_id_fk` FOREIGN KEY (`discount_approved_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  CONSTRAINT `quotations_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quotations`
--

LOCK TABLES `quotations` WRITE;
/*!40000 ALTER TABLE `quotations` DISABLE KEYS */;
/*!40000 ALTER TABLE `quotations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales`
--

DROP TABLE IF EXISTS `sales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `car_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `employee_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `booking_enquiry_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sale_date` date NOT NULL,
  `sale_amount` decimal(14,2) NOT NULL,
  `sale_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Enquiry-based',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Pending',
  `payment_method` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount_paid` decimal(14,2) NOT NULL DEFAULT '0.00',
  `payment_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `registration_status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `rto_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `insurance_policy_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `documents_verified` tinyint(1) NOT NULL DEFAULT '0',
  `handover_date` date DEFAULT NULL,
  `delivery_status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SCHEDULED',
  `is_demo` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `sales_booking_enquiry_id_enquiries_id_fk` (`booking_enquiry_id`),
  KEY `sales_customer_idx` (`customer_id`),
  KEY `sales_branch_idx` (`branch_id`),
  KEY `sales_employee_idx` (`employee_id`),
  KEY `sales_car_idx` (`car_id`),
  KEY `sales_status_idx` (`status`),
  KEY `sales_created_at_idx` (`created_at`),
  CONSTRAINT `sales_booking_enquiry_id_enquiries_id_fk` FOREIGN KEY (`booking_enquiry_id`) REFERENCES `enquiries` (`id`) ON DELETE SET NULL,
  CONSTRAINT `sales_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sales_car_id_cars_id_fk` FOREIGN KEY (`car_id`) REFERENCES `cars` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sales_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sales_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales`
--

LOCK TABLES `sales` WRITE;
/*!40000 ALTER TABLE `sales` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `services`
--

DROP TABLE IF EXISTS `services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `services` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `car_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `employee_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `service_date` date NOT NULL,
  `service_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `cost` decimal(14,2) NOT NULL DEFAULT '0.00',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Scheduled',
  `is_demo` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `services_employee_id_employees_id_fk` (`employee_id`),
  KEY `services_car_idx` (`car_id`),
  KEY `services_customer_idx` (`customer_id`),
  KEY `services_branch_idx` (`branch_id`),
  KEY `services_status_idx` (`status`),
  CONSTRAINT `services_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `services_car_id_cars_id_fk` FOREIGN KEY (`car_id`) REFERENCES `cars` (`id`) ON DELETE CASCADE,
  CONSTRAINT `services_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `services_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `services`
--

LOCK TABLES `services` WRITE;
/*!40000 ALTER TABLE `services` DISABLE KEYS */;
/*!40000 ALTER TABLE `services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `suppliers` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `supplier_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_person` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `phone` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `address` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_demo` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `suppliers_created_at_idx` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `suppliers`
--

LOCK TABLES `suppliers` WRITE;
/*!40000 ALTER TABLE `suppliers` DISABLE KEYS */;
INSERT INTO `suppliers` VALUES ('33b1ad4f-6476-46a6-a464-8f8d3f194807','Hyundai Motor India Ltd','Arun Kumar','+91 44 4710 0000','orders@hyundai.co.in','Irungattukottai, Sriperumbudur, Tamil Nadu',1,'2026-10-14 06:28:38'),('7a5f316b-85ff-461b-824a-161e633873c1','Tata Motors Passenger Vehicles Ltd','Sanjay Verma (North & West OEM Head)','+91 22 6665 8282','dealers@tatamotors.com','Bombay House, 24 Homi Mody Street, Mumbai',1,'2026-10-14 06:28:38'),('c6e7a6b6-9848-4fbc-8363-d848986cd67c','Mahindra & Mahindra Auto Division','Devendra Shinde','+91 22 2490 1441','dealer.network@mahindra.com','Gateway Building, Apollo Bunder, Mumbai',1,'2026-10-14 06:28:38');
/*!40000 ALTER TABLE `suppliers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_roles`
--

DROP TABLE IF EXISTS `user_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_roles` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `app_role` enum('customer','employee','branch_manager','owner') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'customer',
  `branch_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_roles_user_idx` (`user_id`),
  KEY `user_roles_branch_idx` (`branch_id`),
  CONSTRAINT `user_roles_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_roles`
--

LOCK TABLES `user_roles` WRITE;
/*!40000 ALTER TABLE `user_roles` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('OWNER','BRANCH_MANAGER','EMPLOYEE','CUSTOMER') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'EMPLOYEE',
  `branch_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_login_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  KEY `users_branch_idx` (`branch_id`),
  KEY `users_role_idx` (`role`),
  CONSTRAINT `users_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('2906d4eb-ffbd-463a-97c3-179721e53612','Ananya Hegde','employee.blr2@cdms.local','$2b$10$EDQ7ikovbo5If9dPtRtTF./QwptzuO4A5QTw3NoIZEnTEfekTVU/O','EMPLOYEE','27ec6104-6948-4893-bc01-e101da21abea',1,'2026-10-14 06:28:38',NULL),('77b1a359-b40d-42a8-968f-4f22a735f87e','Rajesh Sharma','owner@cdms.local','$2b$10$YrL9cZNUpiGTeR2uGRjhIOxJkahE8RyAHm8eIoRaCVIKjCf5L7/Zq','OWNER',NULL,1,'2026-10-14 06:28:37','2026-10-14 07:07:11'),('c7069ea9-b9d0-41c1-a908-88e2217c3a5b','Sameer Mehta','manager.mumbai@cdms.local','$2b$10$ZygIULRSyCSN6XrPwkGnZ.I2tPOo.qDopotzN5lbAsqXaW01gVTaS','BRANCH_MANAGER','65101080-aa01-4ad4-8c3a-31ded9cf30e8',1,'2026-10-14 06:28:37',NULL),('cb43efb0-904d-4957-aa8e-c2f7ec1bf51b','Rohan Sawant','employee.mumbai1@cdms.local','$2b$10$31SU2wXawHXu1jsWo1/me.2qG67lugrsmjNHaLhqphJLn8MsAipLq','EMPLOYEE','65101080-aa01-4ad4-8c3a-31ded9cf30e8',1,'2026-10-14 06:28:37',NULL),('dfebc276-8736-4a9b-a394-de96256a085a','Pooja Deshmukh','employee.pune2@cdms.local','$2b$10$vcykkMEoY28xz4epW//0/eu3TJ3wocaPjc9wRxa.fJ5AL3o1W9api','EMPLOYEE','15a28da8-6df2-4aeb-92a8-9ef1c14f3315',1,'2026-10-14 06:28:37',NULL),('e13ff5ba-bbd8-4238-a136-de6b092cd304','Neha Patil','employee.mumbai2@cdms.local','$2b$10$O/IZhzkN.TsCtc8z7niKGe0P1OGtuzBNvL2oFPEzY7Tqlm16gq6sS','EMPLOYEE','65101080-aa01-4ad4-8c3a-31ded9cf30e8',1,'2026-10-14 06:28:37',NULL),('e8c03d9e-8943-4a9c-b16e-fefc8192de82','Vikram Joshi','manager.pune@cdms.local','$2b$10$NM.4nqL7QgFn3dtjUqMv3OlUcRGjdyb7gKi/aWD5eN9nKfMJtewaW','BRANCH_MANAGER','15a28da8-6df2-4aeb-92a8-9ef1c14f3315',1,'2026-10-14 06:28:37',NULL),('ea5cfeed-f402-4ba9-96ff-104cf16ef04b','Karthik Gowda','employee.blr1@cdms.local','$2b$10$5eKUjL.h8E0OFrFpPgXGUOWD9qCFaHXL8sTasu66LX2sEj3SiDC4y','EMPLOYEE','27ec6104-6948-4893-bc01-e101da21abea',1,'2026-10-14 06:28:38',NULL),('fbb85ad9-7120-4c9d-8d9a-9a2b24ab0bf5','Kiran Rao','manager.blr@cdms.local','$2b$10$cpC3QGHCZVi7VNDoHoBjA.WGoacIB74k3khf36ED8I.R2tP0174FC','BRANCH_MANAGER','27ec6104-6948-4893-bc01-e101da21abea',1,'2026-10-14 06:28:37',NULL),('fcda3da5-5f74-47a9-9aa9-b53b1d93719c','Amit Kulkarni','employee.pune1@cdms.local','$2b$10$TSL3IyU7jULLh4EvIccuvuVvaDM3dyJZmrsaW0N7gejkAQmKyEUaK','EMPLOYEE','15a28da8-6df2-4aeb-92a8-9ef1c14f3315',1,'2026-10-14 06:28:37',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'cdms'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-14 21:58:36
