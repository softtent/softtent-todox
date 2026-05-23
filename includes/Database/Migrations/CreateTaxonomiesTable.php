<?php

namespace SoftTent\TodoX\Database\Migrations;

defined( 'ABSPATH' ) || exit;

/**
 * Create taxonomies table (flexible status/label system).
 *
 * @since 0.1.0
 */
class CreateTaxonomiesTable {

	public static function up(): void {
		global $wpdb;

		$charset = $wpdb->get_charset_collate();

		// type: task_status | sprint_status | project_status | subtask_status | task_label | subtask_label | project_label
		// workspace_id: NULL = global (visible in all workspaces); set = belongs to that workspace only
		$sql = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}st_todox_taxonomies` (
			`id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			`workspace_id` BIGINT UNSIGNED     DEFAULT NULL,
			`name`         VARCHAR(100)    NOT NULL,
			`slug`         VARCHAR(50)     DEFAULT NULL,
			`type`         VARCHAR(50)     NOT NULL,
			`color`        VARCHAR(20)     NOT NULL DEFAULT '#6366f1',
			`icon`         VARCHAR(100)    DEFAULT NULL,
			`position`     INT             NOT NULL DEFAULT 0,
			`is_active`    TINYINT(1)      NOT NULL DEFAULT 1,
			`created_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			`updated_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (`id`),
			KEY          `workspace_type` (`workspace_id`, `type`(30), `position`)
		) {$charset};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );
	}
}
