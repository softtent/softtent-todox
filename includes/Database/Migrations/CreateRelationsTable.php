<?php

namespace SoftTent\TodoX\Database\Migrations;

defined( 'ABSPATH' ) || exit;

/**
 * Create the universal polymorphic many-to-many pivot table.
 *
 * A single table handles any many-to-many relationship between teams and
 * other entities — no extra table needed for future entity types.
 *
 *   relation_id    — ID of the related model  (e.g. team_id)
 *   relatable_id   — ID of the parent model   (e.g. department_id, project_id)
 *   relatable_type — type of the parent model  (e.g. 'department', 'project')
 *
 * @since 0.1.0
 */
class CreateRelationsTable {

	public static function up(): void {
		global $wpdb;

		$charset = $wpdb->get_charset_collate();
		$table   = $wpdb->prefix . 'st_todox_relations';

		$sql = 'CREATE TABLE IF NOT EXISTS `' . $table . '` (
			`relation_id`    BIGINT UNSIGNED NOT NULL,
			`relatable_id`   BIGINT UNSIGNED NOT NULL,
			`relatable_type` VARCHAR(100)    NOT NULL,
			PRIMARY KEY (`relation_id`, `relatable_id`, `relatable_type`),
			KEY `relatable` (`relatable_id`, `relatable_type`)
		) ' . $charset . ';';

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );
	}
}
