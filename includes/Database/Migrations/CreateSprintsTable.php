<?php

namespace SoftTent\TodoX\Database\Migrations;

defined( 'ABSPATH' ) || exit;

/**
 * Create sprints table.
 *
 * @since 0.1.0
 */
class CreateSprintsTable {

	public static function up(): void {
		global $wpdb;

		$charset = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}st_todox_sprints` (
			`id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			`project_id`  BIGINT UNSIGNED NOT NULL,
			`name`        VARCHAR(200)    NOT NULL,
			`goal`        TEXT            DEFAULT NULL,
			`status_id`   BIGINT UNSIGNED DEFAULT NULL,
			`start_date`  DATE            DEFAULT NULL,
			`end_date`    DATE            DEFAULT NULL,
			`position`    INT             NOT NULL DEFAULT 0,
			`created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			`updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (`id`),
			KEY          `project_id` (`project_id`),
			KEY          `status_id` (`status_id`),
			KEY          `position` (`position`)
		) {$charset};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );
	}
}
