<?php

namespace SoftTent\TodoX\Database\Migrations;

defined( 'ABSPATH' ) || exit;

/**
 * Create workspaces and workspace_members tables.
 *
 * @since 0.1.0
 */
class CreateWorkspacesTable {

	public static function up(): void {
		global $wpdb;

		$charset = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}st_todox_workspaces` (
			`id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			`name`        VARCHAR(200)    NOT NULL,
			`slug`        VARCHAR(200)    NOT NULL,
			`description` TEXT            DEFAULT NULL,
			`logo`        VARCHAR(500)    DEFAULT NULL,
			`color`       VARCHAR(20)     NOT NULL DEFAULT '#6366f1',
			`owner_id`    BIGINT UNSIGNED NOT NULL,
			`is_public`   TINYINT(1)      NOT NULL DEFAULT 0,
			`created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			`updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (`id`),
			UNIQUE KEY   `slug` (`slug`),
			KEY          `owner_id` (`owner_id`)
		) {$charset};";

		$sql2 = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}st_todox_workspace_members` (
			`id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			`workspace_id` BIGINT UNSIGNED NOT NULL,
			`user_id`      BIGINT UNSIGNED NOT NULL,
			`role`         ENUM('owner','admin','member','guest') NOT NULL DEFAULT 'member',
			`joined_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY  (`id`),
			UNIQUE KEY   `workspace_user` (`workspace_id`, `user_id`),
			KEY          `workspace_id` (`workspace_id`),
			KEY          `user_id` (`user_id`)
		) {$charset};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );
		dbDelta( $sql2 );
	}
}
