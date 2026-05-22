<?php
/**
 * SoftTent TodoX
 *
 * @package   SoftTent TodoX
 * @author    SoftTent <contact@softtent.com>
 * @link      https://softtent.com
 * @copyright 2026 SoftTent
 *
 * @wordpress-plugin
 * Plugin Name:       SoftTent TodoX
 * Plugin URI:        https://wordpress.org/plugins/softtent-todox
 * Description:       A professional project management system for WordPress. Manage workspaces, departments, teams, projects, sprints, and tasks with a beautiful Kanban board.
 * Version:           0.1.0
 * Author:            SoftTent
 * Author URI:        https://softtent.com
 * Requires at least: 6.4
 * Requires PHP:      7.4
 * Tested up to:      7.0
 * Text Domain:       softtent-todox
 * Domain Path:       /languages
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 */

defined( 'ABSPATH' ) || exit;

/**
 * Main plugin class.
 *
 * @since 0.1.0
 */
final class ST_TodoX {

	/**
	 * Plugin version.
	 *
	 * @var string
	 */
	const VERSION = '0.1.0';

	/**
	 * Singleton instance.
	 *
	 * @var ST_TodoX|null
	 */
	private static ?ST_TodoX $instance = null;

	/**
	 * Service container.
	 *
	 * @var array<string, object>
	 */
	private array $container = [];

	/**
	 * Constructor.
	 */
	private function __construct() {
		require_once __DIR__ . '/vendor/autoload.php';

		$this->define_constants();

		register_activation_hook( __FILE__, [ $this, 'activate' ] );
		register_deactivation_hook( __FILE__, [ $this, 'deactivate' ] );

		add_action( 'plugins_loaded', [ $this, 'init_plugin' ] );
	}

	/**
	 * Get singleton instance.
	 *
	 * @since 0.1.0
	 */
	public static function init(): ST_TodoX {
		if ( self::$instance === null ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Magic getter for container services.
	 *
	 * @param string $prop Service name.
	 */
	public function __get( string $prop ): mixed {
		return $this->container[ $prop ] ?? null;
	}

	/**
	 * Magic isset check.
	 *
	 * @param string $prop Service name.
	 */
	public function __isset( string $prop ): bool {
		return isset( $this->container[ $prop ] );
	}

	/**
	 * Define plugin constants.
	 *
	 * @since 0.1.0
	 */
	private function define_constants(): void {
		defined( 'ST_TODOX_VERSION' ) || define( 'ST_TODOX_VERSION', self::VERSION );
		defined( 'ST_TODOX_SLUG' ) || define( 'ST_TODOX_SLUG', 'softtent-todox' );
		defined( 'ST_TODOX_FILE' ) || define( 'ST_TODOX_FILE', __FILE__ );
		defined( 'ST_TODOX_DIR' ) || define( 'ST_TODOX_DIR', __DIR__ );
		defined( 'ST_TODOX_PATH' ) || define( 'ST_TODOX_PATH', plugin_dir_path( ST_TODOX_FILE ) );
		defined( 'ST_TODOX_URL' ) || define( 'ST_TODOX_URL', plugins_url( '', ST_TODOX_FILE ) );
		defined( 'ST_TODOX_ASSETS' ) || define( 'ST_TODOX_ASSETS', ST_TODOX_URL . '/build' );
		defined( 'ST_TODOX_TEMPLATE_PATH' ) || define( 'ST_TODOX_TEMPLATE_PATH', ST_TODOX_PATH . 'templates' );
		defined( 'ST_TODOX_DB_VERSION' ) || define( 'ST_TODOX_DB_VERSION', '1.3.0' );
	}

	/**
	 * Boot the plugin after all plugins are loaded.
	 *
	 * @since 0.1.0
	 */
	public function init_plugin(): void {

		do_action( 'st_todox_before_init' );

		$this->includes();

		do_action( 'st_todox_init' );
	}

	/**
	 * Include and instantiate plugin components.
	 *
	 * @since 0.1.0
	 */
	private function includes(): void {
		if ( $this->is_request( 'admin' ) ) {
			$this->container['installer'] = new SoftTent\TodoX\Setup\Installer();
			$this->container['admin_menu'] = new SoftTent\TodoX\Admin\Menu();
		}

		$this->container['frontend']  = new SoftTent\TodoX\Frontend\App();
		$this->container['assets']    = new SoftTent\TodoX\Assets\Manager();
		$this->container['rest_api']  = new SoftTent\TodoX\Api\Controller();
		$this->container['hooks']     = new SoftTent\TodoX\Hooks\Manager();
	}

	/**
	 * Plugin activation handler.
	 *
	 * @since 0.1.0
	 */
	public function activate(): void {
		set_transient( \SoftTent\TodoX\Helpers\Keys::ACTIVATION_REDIRECT, true, 30 );
		SoftTent\TodoX\Frontend\App::create_page();
	}

	/**
	 * Plugin deactivation handler.
	 *
	 * @since 0.1.0
	 */
	public function deactivate(): void {
		delete_transient( \SoftTent\TodoX\Helpers\Keys::ACTIVATION_REDIRECT );
	}

	/**
	 * Determine request type.
	 *
	 * @since 0.1.0
	 *
	 * @param string $type admin|ajax|rest|cron|frontend
	 */
	private function is_request( string $type ): bool {
		switch ( $type ) {
			case 'admin':
				return is_admin();
			case 'ajax':
				return defined( 'DOING_AJAX' );
			case 'rest':
				return defined( 'REST_REQUEST' );
			case 'cron':
				return defined( 'DOING_CRON' );
			case 'frontend':
				return ( ! is_admin() || defined( 'DOING_AJAX' ) ) && ! defined( 'DOING_CRON' );
		}

		return false;
	}
}

/**
 * Returns the main plugin instance.
 *
 * @since 0.1.0
 */
function st_todox(): ST_TodoX {
	return ST_TodoX::init();
}

st_todox();
