<?php

namespace SoftTent\TodoX\Setup;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Helpers\Keys;
use SoftTent\TodoX\Frontend\App;
use SoftTent\TodoX\Database\Migrations\{
	CreateWorkspacesTable,
	CreateDepartmentsTable,
	CreateTeamsTable,
	CreateTaxonomiesTable,
	CreateProjectsTable,
	CreateSprintsTable,
	CreateTasksTable,
	CreateSubtasksTable,
	CreateNotificationsTable
};

/**
 * Plugin installer — runs database migrations on activation/upgrade.
 *
 * @since 0.1.0
 */
class Installer {

	public function __construct() {
		add_action( 'admin_init', [ $this, 'run' ] );
	}

	/**
	 * Run the installer if version has changed.
	 *
	 * @since 0.1.0
	 */
	public function run(): void {
		$installed_version = get_option( Keys::DB_VERSION, '0.0.0' );

		if ( version_compare( $installed_version, \ST_TODOX_DB_VERSION, '<' ) ) {
			$this->record_install_time();
			$this->run_migrations();
			$this->run_seeders();
			$this->backfill_taxonomy_categories();
			$this->alter_tasks_status_column();
			update_option( Keys::DB_VERSION, \ST_TODOX_DB_VERSION );
			update_option( Keys::VERSION, \ST_TODOX_VERSION );
		}

		if ( get_transient( Keys::ACTIVATION_REDIRECT ) ) {
			delete_transient( Keys::ACTIVATION_REDIRECT );

			// phpcs:ignore WordPress.Security.NonceVerification.Recommended
			if ( ! is_network_admin() && ! isset( $_GET['activate-multi'] ) ) {
				wp_safe_redirect( App::get_page_url() );
				exit;
			}
		}
	}

	/**
	 * Record first install datetime.
	 *
	 * @since 0.1.0
	 */
	private function record_install_time(): void {
		if ( ! get_option( Keys::INSTALLED_AT ) ) {
			update_option( Keys::INSTALLED_AT, current_datetime()->format( 'Y-m-d H:i:s' ) );
		}
	}

	/**
	 * Run all database migrations in order.
	 *
	 * @since 0.1.0
	 */
	private function run_migrations(): void {
		CreateWorkspacesTable::up();
		CreateDepartmentsTable::up();
		CreateTeamsTable::up();
		CreateTaxonomiesTable::up();
		CreateProjectsTable::up();
		CreateSprintsTable::up();
		CreateTasksTable::up();
		CreateSubtasksTable::up();
		CreateNotificationsTable::up();
	}

	/**
	 * Seed default data for fresh installs.
	 *
	 * @since 0.1.0
	 */
	private function run_seeders(): void {
		$seeder = new Seeder();
		$seeder->run();
	}

	/**
	 * Convert the tasks.status column from ENUM to VARCHAR so custom statuses can be stored.
	 *
	 * Direct database query is necessary here because:
	 * 1. Schema changes require ALTER TABLE which WordPress does not provide an API for
	 * 2. This runs during plugin upgrade, not on normal page requests
	 *
	 * @since 1.2.0
	 */
	private function alter_tasks_status_column(): void {
		global $wpdb;

		$table = $wpdb->prefix . 'st_todox_tasks';

		// Use SHOW COLUMNS — more reliable than INFORMATION_SCHEMA in restricted environments.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$col = $wpdb->get_row(
			$wpdb->prepare(
				'SHOW COLUMNS FROM %i LIKE %s',
				$table,
				'status'
			),
			ARRAY_A
		);

		if ( $col && stripos( $col['Type'], 'enum' ) !== false ) {
			// phpcs:disable WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Necessary for migrating custom table schema.
			$wpdb->query(
				$wpdb->prepare(
					'ALTER TABLE %i MODIFY COLUMN %s VARCHAR(100) NOT NULL DEFAULT %s',
					$table,
					'status',
					'todo'
				)
			);
			// phpcs:enable
		}
	}

	/**
	 * Backfill category (slug) on taxonomy rows that were created before v1.1.0.
	 *
	 * @since 1.1.0
	 */
	private function backfill_taxonomy_categories(): void {
		global $wpdb;

		$table = $wpdb->prefix . 'st_todox_taxonomies';

		$known = [
			'To Do'       => 'todo',
			'In Progress' => 'in_progress',
			'In Review'   => 'review',
			'Completed'   => 'completed',
			'Planned'     => 'planned',
			'Active'      => 'active',
			'Archived'    => 'archived',
		];

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT id, name FROM %i WHERE category IS NULL OR category = %s',
				$table,
				''
			),
			ARRAY_A
		);

		foreach ( $rows as $row ) {
			$category = $known[ $row['name'] ] ?? strtolower( trim( preg_replace( '/[^a-z0-9]+/i', '_', $row['name'] ) ) );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$wpdb->update( $table, [ 'category' => $category ], [ 'id' => (int) $row['id'] ] );
		}
	}
}
