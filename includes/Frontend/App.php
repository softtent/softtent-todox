<?php

namespace SoftTent\TodoX\Frontend;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Helpers\Keys;

/**
 * Frontend app page — creates a real WordPress page on activation and serves
 * the React SPA via template_include, so no custom rewrite rules are needed.
 *
 * @since 0.2.0
 */
class App {

	public function __construct() {
		add_filter( 'template_include', [ $this, 'load_app_template' ] );
		add_action( 'wp_enqueue_scripts', [ $this, 'maybe_dequeue_third_party' ], PHP_INT_MAX );
	}

	/**
	 * Create the WordPress page that hosts the app. Idempotent — safe to call
	 * on every activation.
	 *
	 * @since 0.2.0
	 */
	public static function create_page(): void {
		$page_id = (int) get_option( Keys::PAGE_ID, 0 );

		if ( $page_id && get_post_status( $page_id ) === 'publish' ) {
			return;
		}

		$existing = get_page_by_path( \ST_TODOX_SLUG );
		if ( $existing ) {
			update_option( Keys::PAGE_ID, $existing->ID );
			return;
		}

		$new_id = wp_insert_post(
            [
				'post_title'   => esc_html__( 'TodoX', 'softtent-todox' ),
				'post_name'    => 'todox',
				'post_status'  => 'publish',
				'post_type'    => 'page',
				'post_content' => '',
				'post_author'  => get_current_user_id(),
			]
        );

		if ( $new_id && ! is_wp_error( $new_id ) ) {
			update_option( Keys::PAGE_ID, $new_id );
		}
	}

	/**
	 * Permanently delete the app page. Called on uninstall.
	 *
	 * @since 0.2.0
	 */
	public static function delete_page(): void {
		$page_id = (int) get_option( Keys::PAGE_ID, 0 );

		if ( $page_id ) {
			wp_delete_post( $page_id, true );
		}

		delete_option( Keys::PAGE_ID );
	}

	/**
	 * Return the public URL of the app page.
	 *
	 * @since 0.2.0
	 */
	public static function get_page_url(): string {
		$page_id = (int) get_option( Keys::PAGE_ID, 0 );

		if ( $page_id ) {
			$url = get_permalink( $page_id );
			return $url ? (string) $url : home_url( '/' . \ST_TODOX_SLUG . '/' );
		}

		return home_url( '/' . \ST_TODOX_SLUG . '/' );
	}

	/**
	 * Whether the current request is for the app page.
	 *
	 * @since 0.2.0
	 */
	public static function is_app_page(): bool {
		$page_id = (int) get_option( Keys::PAGE_ID, 0 );

		return $page_id ? is_page( $page_id ) : is_page( \ST_TODOX_SLUG );
	}

	/**
	 * Swap in the standalone app template when on the app page.
	 *
	 * @since 0.2.0
	 *
	 * @param string $template Resolved template path from WordPress.
	 * @return string
	 */
	public function load_app_template( string $template ): string {
		if ( ! self::is_app_page() ) {
			return $template;
		}

		if ( ! is_user_logged_in() ) {
			auth_redirect();
		}

		show_admin_bar( false );

		$custom = \ST_TODOX_PATH . 'templates/app.php';

		return file_exists( $custom ) ? $custom : $template;
	}

	/**
	 * Dequeue all third-party scripts/styles on the app page.
	 * Runs at PHP_INT_MAX so our own assets survive.
	 *
	 * @since 0.2.0
	 */
	public function maybe_dequeue_third_party(): void {
		if ( ! self::is_app_page() ) {
			return;
		}

		global $wp_scripts, $wp_styles;

		$keep_scripts = [ 'softtent-todox', 'st-todox-i18n-loader' ];
		$keep_styles  = [ 'softtent-todox' ];

		foreach ( array_keys( $wp_scripts->registered ) as $handle ) {
			if ( ! in_array( $handle, $keep_scripts, true ) ) {
				wp_dequeue_script( $handle );
			}
		}

		foreach ( array_keys( $wp_styles->registered ) as $handle ) {
			if ( ! in_array( $handle, $keep_styles, true ) ) {
				wp_dequeue_style( $handle );
			}
		}
	}
}
