<?php

namespace SoftTent\TodoX\Assets;

defined( 'ABSPATH' ) || exit;

/**
 * Asset manager — registers and enqueues scripts/styles.
 *
 * @since 0.1.0
 */
class Manager {

	public function __construct() {
		add_action( 'init', [ $this, 'register_all' ] );
		add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_admin' ] );
		add_filter( 'admin_body_class', [ $this, 'add_body_class' ] );
		add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_frontend' ] );
	}

	/**
	 * Add todox body class when on the plugin page.
	 *
	 * @since 0.1.0
	 *
	 * @param string $classes Space-separated body class string.
	 */
	public function add_body_class( string $classes ): string {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( isset( $_GET['page'] ) && sanitize_text_field( wp_unslash( $_GET['page'] ) ) === \ST_TODOX_SLUG ) {
			$classes .= ' todox';
		}

		return $classes;
	}

	/**
	 * Register all scripts and styles on init — register only, do not enqueue.
	 *
	 * @since 0.1.0
	 */
	public function register_all(): void {
		$this->register_i18n_loader();
		$this->register_styles();
		$this->register_scripts();
	}

	/**
	 * Register i18n loader script (chunk translation support).
	 *
	 * Enqueuing happens in enqueue_admin() / enqueue_frontend() — not here.
	 *
	 * @since 0.1.0
	 */
	private function register_i18n_loader(): void {
		$asset_file = \ST_TODOX_DIR . '/build/i18n-loader.asset.php';

		if ( ! file_exists( $asset_file ) ) {
			return;
		}

		$asset = require $asset_file;

		wp_register_script(
			'st-todox-i18n-loader',
			\ST_TODOX_ASSETS . '/i18n-loader.js',
			$asset['dependencies'],
			$asset['version'],
			true
		);
	}

	/**
	 * Register main CSS bundle.
	 *
	 * @since 0.1.0
	 */
	private function register_styles(): void {
		$css_file = \ST_TODOX_DIR . '/build/index.css';

		if ( ! file_exists( $css_file ) ) {
			return;
		}

		wp_register_style(
			'softtent-todox',
			\ST_TODOX_ASSETS . '/index.css',
			[],
			\ST_TODOX_VERSION
		);
	}

	/**
	 * Register main JS bundle.
	 *
	 * @since 0.1.0
	 */
	private function register_scripts(): void {
		$asset_file = \ST_TODOX_DIR . '/build/index.asset.php';

		if ( ! file_exists( $asset_file ) ) {
			return;
		}

		$asset = require $asset_file;

		wp_register_script(
			'softtent-todox',
			\ST_TODOX_ASSETS . '/index.js',
			$asset['dependencies'],
			$asset['version'],
			true
		);
	}

	/**
	 * Enqueue assets only on the plugin's admin page.
	 *
	 * @since 0.1.0
	 */
	public function enqueue_admin(): void {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ! is_admin() || ! isset( $_GET['page'] ) || sanitize_text_field( wp_unslash( $_GET['page'] ) ) !== \ST_TODOX_SLUG ) {
			return;
		}

		wp_enqueue_media();
		wp_enqueue_style( 'softtent-todox' );
		wp_enqueue_script( 'softtent-todox' );

		wp_localize_script( 'softtent-todox', 'stTodoxParams', $this->get_script_data() );
	}

	/**
	 * Enqueue assets on the frontend app page.
	 *
	 * @since 0.2.0
	 */
	public function enqueue_frontend(): void {
		if ( ! \SoftTent\TodoX\Frontend\App::is_app_page() ) {
			return;
		}

		wp_enqueue_style( 'softtent-todox' );
		wp_enqueue_script( 'softtent-todox' );
		wp_localize_script( 'softtent-todox', 'stTodoxParams', $this->get_script_data() );
	}

	/**
	 * Build the data object passed to the React app.
	 *
	 * @since 0.1.0
	 *
	 * @return array<string, mixed>
	 */
	private function get_script_data(): array {
		$current_user = wp_get_current_user();

		return apply_filters(
			'st_todox_script_data',
			[
				'nonce'       => wp_create_nonce( 'wp_rest' ),
				'restUrl'     => esc_url_raw( rest_url() ),
				'adminUrl'    => esc_url_raw( admin_url() ),
				'pluginUrl'   => esc_url_raw( \ST_TODOX_URL ),
				'version'     => \ST_TODOX_VERSION,
				'currentUser' => [
					'id'     => $current_user->ID,
					'name'   => $current_user->display_name,
					'email'  => $current_user->user_email,
					'avatar' => get_avatar_url( $current_user->ID, [ 'size' => 40 ] ),
					'roles'  => $current_user->roles,
				],
			]
		);
	}
}
