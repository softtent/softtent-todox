<?php

namespace SoftTent\TodoX\Database\Migrations;

defined( 'ABSPATH' ) || exit;

/**
 * Create teams and team_members tables.
 *
 * @since 0.1.0
 */
class CreateTeamsTable {

	public static function up(): void {
		global $wpdb;

		$charset = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}st_todox_teams` (
			`id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			`department_id` BIGINT UNSIGNED NOT NULL,
			`workspace_id`  BIGINT UNSIGNED NOT NULL,
			`name`          VARCHAR(200)    NOT NULL,
			`description`   TEXT            DEFAULT NULL,
			`color`         VARCHAR(20)     NOT NULL DEFAULT '#6366f1',
			`avatar`        VARCHAR(500)    DEFAULT NULL,
			`manager_id`    BIGINT UNSIGNED DEFAULT NULL,
			`created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			`updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (`id`),
			KEY          `department_id` (`department_id`),
			KEY          `workspace_id` (`workspace_id`),
			KEY          `manager_id` (`manager_id`)
		) {$charset};";

		$sql2 = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}st_todox_team_members` (
			`id`        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			`team_id`   BIGINT UNSIGNED NOT NULL,
			`user_id`   BIGINT UNSIGNED NOT NULL,
			`team_role` ENUM('lead','member') NOT NULL DEFAULT 'member',
			`joined_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY  (`id`),
			UNIQUE KEY   `team_user` (`team_id`, `user_id`),
			KEY          `team_id` (`team_id`),
			KEY          `user_id` (`user_id`)
		) {$charset};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );
		dbDelta( $sql2 );
	}
}
