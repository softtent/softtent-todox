<?php

namespace SoftTent\TodoX\Database\Migrations;

defined( 'ABSPATH' ) || exit;

/**
 * Create notifications and audit_logs tables.
 *
 * @since 0.1.0
 */
class CreateNotificationsTable {

	public static function up(): void {
		global $wpdb;

		$charset = $wpdb->get_charset_collate();

		$notifications = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}st_todox_notifications` (
			`id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			`user_id`    BIGINT UNSIGNED NOT NULL,
			`title`      VARCHAR(300)    NOT NULL,
			`message`    TEXT            NOT NULL,
			`type`       VARCHAR(50)     NOT NULL DEFAULT 'info',
			`is_read`    TINYINT(1)      NOT NULL DEFAULT 0,
			`link`       VARCHAR(500)    DEFAULT NULL,
			`meta`       JSON            DEFAULT NULL,
			`created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY  (`id`),
			KEY          `user_id_read` (`user_id`, `is_read`)
		) {$charset};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $notifications );
	}
}
