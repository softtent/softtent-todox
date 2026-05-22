<?php

namespace SoftTent\TodoX\Database\Migrations;

defined( 'ABSPATH' ) || exit;

/**
 * Create projects table.
 *
 * @since 0.1.0
 */
class CreateProjectsTable {

	public static function up(): void {
		global $wpdb;

		$charset = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}st_todox_projects` (
			`id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			`team_id`      BIGINT UNSIGNED NOT NULL,
			`workspace_id` BIGINT UNSIGNED NOT NULL,
			`name`         VARCHAR(200)    NOT NULL,
			`description`  TEXT            DEFAULT NULL,
			`color`        VARCHAR(20)     NOT NULL DEFAULT '#6366f1',
			`icon`         VARCHAR(100)    DEFAULT NULL,
			`status`       ENUM('active','completed','archived') NOT NULL DEFAULT 'active',
			`taxonomy_id`  BIGINT UNSIGNED DEFAULT NULL,
			`owner_id`     BIGINT UNSIGNED NOT NULL,
			`created_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			`updated_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (`id`),
			KEY          `team_id` (`team_id`),
			KEY          `workspace_id` (`workspace_id`),
			KEY          `owner_id` (`owner_id`),
			KEY          `status` (`status`)
		) {$charset};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );
	}
}
