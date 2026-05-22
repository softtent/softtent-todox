<?php

namespace SoftTent\TodoX\Admin;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Frontend\App;

/**
 * WordPress admin menu registration.
 *
 * @since 0.1.0
 */
class Menu {

	public function __construct() {
		add_action( 'admin_menu', [ $this, 'register_menu' ] );
		add_action( 'admin_init', [ $this, 'redirect_to_frontend' ] );
	}

	/**
	 * Register the plugin's top-level admin menu.
	 *
	 * Clicking the menu item redirects to the standalone frontend page;
	 * no admin SPA page is rendered.
	 *
	 * @since 0.1.0
	 */
	public function register_menu(): void {
		add_menu_page(
			esc_html__( 'TodoX', 'softtent-todox' ),
			esc_html__( 'TodoX', 'softtent-todox' ),
			'read',
			\ST_TODOX_SLUG,
			'__return_null',
			'dashicons-chart-bar',
			30
		);

		// Remove the auto-generated duplicate submenu entry.
		remove_submenu_page( \ST_TODOX_SLUG, \ST_TODOX_SLUG );

		// Point the menu item directly to the frontend URL instead of admin.php?page=….
		global $menu;
		$app_url = App::get_page_url();
		foreach ( $menu as $key => $item ) {
			if ( isset( $item[2] ) && $item[2] === \ST_TODOX_SLUG ) {
				$menu[ $key ][2] = $app_url; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
				break;
			}
		}
	}

	/**
	 * Safety-net redirect: if someone navigates to admin.php?page=todox
	 * directly, send them to the frontend app.
	 *
	 * @since 0.1.0
	 */
	public function redirect_to_frontend(): void {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( isset( $_GET['page'] ) && sanitize_text_field( wp_unslash( $_GET['page'] ) ) === \ST_TODOX_SLUG ) {
			wp_safe_redirect( App::get_page_url() );
			exit;
		}
	}
}
