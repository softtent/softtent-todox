<?php

namespace SoftTent\TodoX\Setup;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Helpers\Keys;
use SoftTent\TodoX\Frontend\App;
use SoftTent\TodoX\Database\Migrations\{
	CreateWorkspacesTable,
	CreateDepartmentsTable,
	CreateTeamsTable,
	CreateRelationsTable,
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
		// Migrations must run on both admin page loads AND REST API calls so that
		// schema upgrades are in place before any endpoint handler executes.
		add_action( 'admin_init', [ $this, 'run' ] );
		add_action( 'rest_api_init', [ $this, 'maybe_migrate' ] );
	}

	/**
	 * Run migrations + activation redirect (admin page loads only).
	 *
	 * @since 0.1.0
	 */
	public function run(): void {
		$this->maybe_migrate();

		if ( get_transient( Keys::ACTIVATION_REDIRECT ) ) {
			delete_transient( Keys::ACTIVATION_REDIRECT );

			// phpcs:ignore WordPress.Security.NonceVerification.Recommended
			if ( ! is_network_admin() && ! isset( $_GET['activate-multi'] ) ) {
				$url = App::get_page_url();
				// Hash-route deep link to the onboarding wizard.
				$url = ( strpos( $url, '#' ) === false ? $url : strstr( $url, '#', true ) ) . '#/welcome';
				wp_safe_redirect( $url );
				exit;
			}
		}
	}

	/**
	 * Run migrations if the stored DB version is behind the current constant.
	 * Safe to call on any request type — no redirects, no side-effects.
	 *
	 * @since 0.1.0
	 */
	public function maybe_migrate(): void {
		static $ran = false;
		if ( $ran ) {
			return;
		}
		$ran = true;

		$installed_version = get_option( Keys::DB_VERSION, '0.0.0' );

		if ( version_compare( $installed_version, \ST_TODOX_DB_VERSION, '<' ) ) {
			$this->record_install_time();
			$this->run_migrations();
			$this->run_seeders();
			update_option( Keys::DB_VERSION, \ST_TODOX_DB_VERSION );
			update_option( Keys::VERSION, \ST_TODOX_VERSION );
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
		CreateRelationsTable::up();
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
}
