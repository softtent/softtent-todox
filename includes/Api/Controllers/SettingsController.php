<?php

namespace SoftTent\TodoX\Api\Controllers;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Abstracts\RestApi;
use SoftTent\TodoX\Helpers\Keys;

/**
 * REST controller for plugin settings.
 *
 * @since 0.1.0
 */
class SettingsController extends RestApi {

	protected $base = 'settings';

	public function routes(): void {
		register_rest_route(
            $this->namespace, '/' . $this->base, [
				[
					'methods' => 'GET',
					'callback' => [ $this, 'index' ],
					'permission_callback' => [ $this, 'is_admin' ],
				],
				[
					'methods' => 'PUT',
					'callback' => [ $this, 'update' ],
					'permission_callback' => [ $this, 'is_admin' ],
				],
			]
        );
	}

	private function defaults(): array {
		return [
			'keep_data_on_uninstall' => true,
		];
	}

	public function index( \WP_REST_Request $request ): \WP_REST_Response { // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
		return $this->ok( array_merge( $this->defaults(), get_option( Keys::SETTINGS, [] ) ) );
	}

	public function update( \WP_REST_Request $req ): \WP_REST_Response {
		$params   = $req->get_params();
		$settings = array_merge( $this->defaults(), get_option( Keys::SETTINGS, [] ) );

		$allowed = apply_filters(
            'st_todox_allowed_settings_keys', [
				'date_format',
				'week_start',
				'default_priority',
				'email_notifications',
				'keep_data_on_uninstall',
			]
        );

		foreach ( $allowed as $key ) {
			if ( array_key_exists( $key, $params ) ) {
				$settings[ $key ] = sanitize_text_field( $params[ $key ] );
			}
		}

		update_option( Keys::SETTINGS, $settings );

		return $this->ok( $settings, esc_html__( 'Settings saved.', 'softtent-todox' ) );
	}
}
