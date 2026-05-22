<?php

namespace SoftTent\TodoX\Database\Migrations;

defined( 'ABSPATH' ) || exit;

/**
 * Create tasks and related tables.
 *
 * @since 0.1.0
 */
class CreateTasksTable {

	public static function up(): void {
		global $wpdb;

		$charset = $wpdb->get_charset_collate();

		$tasks = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}st_todox_tasks` (
			`id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			`sprint_id`    BIGINT UNSIGNED DEFAULT NULL,
			`project_id`   BIGINT UNSIGNED DEFAULT NULL,
			`workspace_id` BIGINT UNSIGNED DEFAULT NULL,
			`title`        VARCHAR(500)    NOT NULL,
			`description`  LONGTEXT        DEFAULT NULL,
			`status`       VARCHAR(100)    NOT NULL DEFAULT 'todo',
			`taxonomy_id`  BIGINT UNSIGNED DEFAULT NULL,
			`priority`     ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
			`due_date`     DATE            DEFAULT NULL,
			`position`     INT             NOT NULL DEFAULT 0,
			`is_archived`  TINYINT(1)      NOT NULL DEFAULT 0,
			`assignee_id`  BIGINT UNSIGNED DEFAULT NULL,
			`creator_id`   BIGINT UNSIGNED NOT NULL,
			`created_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			`updated_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (`id`),
			KEY          `sprint_id` (`sprint_id`),
			KEY          `project_id` (`project_id`),
			KEY          `workspace_id` (`workspace_id`),
			KEY          `status` (`status`),
			KEY          `priority` (`priority`),
			KEY          `assignee_id` (`assignee_id`),
			KEY          `creator_id` (`creator_id`),
			KEY          `due_date` (`due_date`),
			KEY          `position` (`position`)
		) {$charset};";

		$labels = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}st_todox_task_labels` (
			`id`      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			`task_id` BIGINT UNSIGNED NOT NULL,
			`name`    VARCHAR(100)    NOT NULL,
			`color`   VARCHAR(20)     NOT NULL DEFAULT '#6366f1',
			PRIMARY KEY  (`id`),
			KEY          `task_id` (`task_id`)
		) {$charset};";

		$comments = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}st_todox_task_comments` (
			`id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			`task_id`    BIGINT UNSIGNED NOT NULL,
			`author_id`  BIGINT UNSIGNED NOT NULL,
			`content`    LONGTEXT        NOT NULL,
			`created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			`updated_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (`id`),
			KEY          `task_id` (`task_id`)
		) {$charset};";

		$activities = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}st_todox_task_activities` (
			`id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			`task_id`    BIGINT UNSIGNED NOT NULL,
			`user_id`    BIGINT UNSIGNED NOT NULL,
			`action`     VARCHAR(100)    NOT NULL,
			`detail`     TEXT            DEFAULT NULL,
			`created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY  (`id`),
			KEY          `task_id` (`task_id`)
		) {$charset};";

		$attachments = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}st_todox_task_attachments` (
			`id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			`task_id`     BIGINT UNSIGNED NOT NULL,
			`filename`    VARCHAR(255)    NOT NULL,
			`url`         VARCHAR(1000)   NOT NULL,
			`size`        INT             NOT NULL DEFAULT 0,
			`mime_type`   VARCHAR(100)    NOT NULL,
			`uploaded_by` BIGINT UNSIGNED NOT NULL,
			`created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY  (`id`),
			KEY          `task_id` (`task_id`)
		) {$charset};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $tasks );
		dbDelta( $labels );
		dbDelta( $comments );
		dbDelta( $activities );
		dbDelta( $attachments );
	}
}
