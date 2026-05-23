<?php

namespace SoftTent\TodoX\Database\Migrations;

defined( 'ABSPATH' ) || exit;

/**
 * Create subtasks table.
 *
 * @since 0.1.0
 */
class CreateSubtasksTable {

	public static function up(): void {
		global $wpdb;

		$charset = $wpdb->get_charset_collate();

		$subtasks = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}st_todox_subtasks` (
			`id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			`task_id`     BIGINT UNSIGNED NOT NULL,
			`title`       VARCHAR(500)    NOT NULL,
			`description` TEXT            DEFAULT NULL,
			`status_id`   BIGINT UNSIGNED DEFAULT NULL,
			`label_ids`   JSON            DEFAULT NULL,
			`priority`    ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
			`start_date`  DATE            DEFAULT NULL,
			`due_date`    DATE            DEFAULT NULL,
			`completed`   TINYINT(1)      NOT NULL DEFAULT 0,
			`position`    INT             NOT NULL DEFAULT 0,
			`assignee_id` BIGINT UNSIGNED DEFAULT NULL,
			`created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			`updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (`id`),
			KEY          `task_id` (`task_id`),
			KEY          `assignee_id` (`assignee_id`),
			KEY          `status_id` (`status_id`)
		) {$charset};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $subtasks );
	}
}
