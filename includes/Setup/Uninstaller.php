<?php

namespace SoftTent\TodoX\Setup;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Helpers\Keys;
use SoftTent\TodoX\Frontend\App;

/**
 * Handles plugin uninstall cleanup.
 *
 * @since 0.1.0
 */
class Uninstaller {

	public function run(): void {
		$settings  = get_option( Keys::SETTINGS, [] );
		$keep_data = $settings['keep_data_on_uninstall'] ?? true;

		if ( $keep_data ) {
			return;
		}

		$this->drop_tables();
		$this->delete_options();
		App::delete_page();
	}

	/**
	 * Drop all plugin tables.
	 *
	 * Direct database query is necessary here because:
	 * 1. These are custom tables not managed by WordPress core
	 * 2. No alternative WordPress API exists for dropping tables
	 * 3. This only runs during plugin uninstall, not on normal requests
	 *
	 * @since 0.1.0
	 */
	private function drop_tables(): void {
		global $wpdb;

		$tables = [
			'st_todox_audit_logs',
			'st_todox_notifications',
			'st_todox_subtask_labels',
			'st_todox_subtasks',
			'st_todox_task_attachments',
			'st_todox_task_activities',
			'st_todox_task_comments',
			'st_todox_task_labels',
			'st_todox_tasks',
			'st_todox_sprints',
			'st_todox_projects',
			'st_todox_taxonomies',
			'st_todox_team_members',
			'st_todox_teams',
			'st_todox_departments',
			'st_todox_workspace_members',
			'st_todox_workspaces',
		];

		foreach ( $tables as $table ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Necessary for dropping custom tables during uninstall.
			$wpdb->query( $wpdb->prepare( 'DROP TABLE IF EXISTS %i', $wpdb->prefix . $table ) );
		}
	}

	private function delete_options(): void {
		delete_option( Keys::VERSION );
		delete_option( Keys::DB_VERSION );
		delete_option( Keys::INSTALLED_AT );
		delete_option( Keys::SETTINGS );
	}
}
