<?php

namespace SoftTent\TodoX\Helpers;

defined( 'ABSPATH' ) || exit;

/**
 * General helper functions.
 *
 * @since 0.1.0
 */
class Fns {

	/**
	 * Get plugin setting value.
	 *
	 * @since 0.1.0
	 *
	 * @param string $key     Setting key.
	 * @param mixed  $default Default value.
	 */
	public static function get_setting( string $key, mixed $fallback = null ): mixed {
		$settings = get_option( Keys::SETTINGS, [] );

		return $settings[ $key ] ?? $fallback;
	}

	/**
	 * Update a plugin setting.
	 *
	 * @since 0.1.0
	 */
	public static function update_setting( string $key, mixed $value ): bool {
		$settings         = get_option( Keys::SETTINGS, [] );
		$settings[ $key ] = $value;

		return update_option( Keys::SETTINGS, $settings );
	}

	/**
	 * Generate a unique slug from a string, ensuring uniqueness in a given table/column.
	 *
	 * @since 0.1.0
	 *
	 * @param string $name      Source string.
	 * @param string $table     Table name (without prefix).
	 * @param string $column    Column to check uniqueness against.
	 * @param int    $exclude_id Row ID to exclude (for updates).
	 */
	public static function generate_slug( string $name, string $table, string $column = 'slug', int $exclude_id = 0 ): string {
		global $wpdb;

		$slug     = sanitize_title( $name );
		$original = $slug;
		$i        = 1;
		$tbl      = $wpdb->prefix . $table;

		while ( true ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$exists = $wpdb->get_var(
				$wpdb->prepare(
					'SELECT id FROM %i WHERE %i = %s AND id != %d LIMIT 1',
					$tbl,
					$column,
					$slug,
					$exclude_id
				)
			);

			if ( ! $exists ) {
				break;
			}

			$slug = $original . '-' . $i;
			++$i;
		}

		return $slug;
	}

	/**
	 * Get current user data for API responses.
	 *
	 * @since 0.1.0
	 *
	 * @return array<string, mixed>
	 */
	public static function get_current_user_data(): array {
		$user = wp_get_current_user();

		return [
			'id'     => $user->ID,
			'name'   => $user->display_name,
			'email'  => $user->user_email,
			'avatar' => get_avatar_url( $user->ID, [ 'size' => 40 ] ),
			'roles'  => $user->roles,
		];
	}

	/**
	 * Sanitize and validate color hex value.
	 *
	 * @since 0.1.0
	 */
	public static function sanitize_color( string $color ): string {
		$color = sanitize_hex_color( $color );

		return $color ? $color : '#6366f1';
	}

	/**
	 * Format a MySQL datetime for API responses.
	 *
	 * @since 0.1.0
	 */
	public static function format_datetime( ?string $datetime ): ?string {
		if ( ! $datetime ) {
			return null;
		}

		return mysql2date( 'c', $datetime );
	}

	/**
	 * Get pagination parameters from a REST request.
	 *
	 * @since 0.1.0
	 *
	 * @param \WP_REST_Request $request
	 * @return array{per_page: int, page: int, offset: int}
	 */
	public static function get_pagination( \WP_REST_Request $request ): array {
		$per_page = (int) ( $request->get_param( 'per_page' ) ?? 20 );
		$page     = max( 1, (int) ( $request->get_param( 'page' ) ?? 1 ) );
		$per_page = min( 500, max( 1, $per_page ) );
		$offset   = ( $page - 1 ) * $per_page;

		return compact( 'per_page', 'page', 'offset' );
	}

	/**
	 * Build a standard success response.
	 *
	 * @since 0.1.0
	 *
	 * @param mixed  $data    Response data.
	 * @param string $message Optional message.
	 * @param int    $status  HTTP status code.
	 */
	public static function success( mixed $data, string $message = '', int $status = 200 ): \WP_REST_Response {
		$response = [
			'success' => true,
			'data' => $data,
		];

		if ( $message ) {
			$response['message'] = $message;
		}

		return new \WP_REST_Response( $response, $status );
	}

	/**
	 * Build a standard error response.
	 *
	 * @since 0.1.0
	 *
	 * @param string|array $errors  Error message(s).
	 * @param int          $status  HTTP status code.
	 */
	public static function error( string|array $errors, int $status = 400 ): \WP_REST_Response {
		return new \WP_REST_Response(
			[
				'success' => false,
				'data'    => is_array( $errors ) ? $errors : [ $errors ],
			],
			$status
		);
	}

	/**
	 * Get WordPress user info by ID for embedding in responses.
	 *
	 * @since 0.1.0
	 *
	 * @return array<string, mixed>|null
	 */
	public static function get_user_info( int $user_id ): ?array {
		if ( ! $user_id ) {
			return null;
		}

		$user = get_userdata( $user_id );

		if ( ! $user ) {
			return null;
		}

		return [
			'id'     => $user->ID,
			'name'   => $user->display_name,
			'email'  => $user->user_email,
			'avatar' => get_avatar_url( $user->ID, [ 'size' => 40 ] ),
		];
	}
}
