<?php

namespace SoftTent\TodoX\Database\Migrations;

defined( 'ABSPATH' ) || exit;

/**
 * Create departments table.
 *
 * @since 0.1.0
 */
class CreateDepartmentsTable {

	public static function up(): void {
		global $wpdb;

		$charset = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}st_todox_departments` (
			`id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			`workspace_id` BIGINT UNSIGNED NOT NULL,
			`name`         VARCHAR(200)    NOT NULL,
			`description`  TEXT            DEFAULT NULL,
			`color`        VARCHAR(20)     NOT NULL DEFAULT '#6366f1',
			`head_id`      BIGINT UNSIGNED DEFAULT NULL,
			`position`     INT             NOT NULL DEFAULT 0,
			`created_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			`updated_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (`id`),
			KEY          `workspace_id` (`workspace_id`),
			KEY          `head_id` (`head_id`),
			KEY          `position` (`position`)
		) {$charset};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );
	}
}
