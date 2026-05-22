<?php

namespace SoftTent\TodoX\Models;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Helpers\Fns;

/**
 * Notification model.
 *
 * Direct database queries are used throughout this class because:
 * 1. These are custom tables not managed by WordPress core
 * 2. No alternative WordPress API exists for querying custom table data
 * 3. All queries use $wpdb->prepare() with proper placeholders for security
 *
 * @since 0.1.0
 */
class Notification {

	private static string $table = 'st_todox_notifications';

	public static function get_all( int $user_id, array $args = [] ): array {
		global $wpdb;

		$unread_only = ! empty( $args['unread_only'] );
		$per_page    = (int) ( $args['per_page'] ?? 20 );
		$offset      = (int) ( $args['offset'] ?? 0 );

		$cache_key = 'notifications_' . $user_id . '_' . (int) $unread_only . '_' . $per_page . '_' . $offset;
		$cached    = wp_cache_get( $cache_key, 'softtent-todox' );

		if ( false !== $cached ) {
			return $cached;
		}

		if ( $unread_only ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT * FROM %i WHERE user_id = %d AND is_read = 0 ORDER BY created_at DESC LIMIT %d OFFSET %d',
					$wpdb->prefix . self::$table,
					$user_id,
					$per_page,
					$offset
				),
				ARRAY_A
			);
		} else {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT * FROM %i WHERE user_id = %d ORDER BY created_at DESC LIMIT %d OFFSET %d',
					$wpdb->prefix . self::$table,
					$user_id,
					$per_page,
					$offset
				),
				ARRAY_A
			);
		}

		$result = array_map( [ self::class, 'format' ], $rows ?? [] );
		wp_cache_set( $cache_key, $result, 'softtent-todox' );

		return $result;
	}

	public static function create( int $user_id, string $title, string $message, string $type = 'info', ?string $link = null, ?array $meta = null ): int|false {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$inserted = $wpdb->insert(
			$wpdb->prefix . self::$table,
			[
				'user_id' => $user_id,
				'title'   => sanitize_text_field( $title ),
				'message' => sanitize_text_field( $message ),
				'type'    => sanitize_text_field( $type ),
				'link'    => $link ? esc_url_raw( $link ) : null,
				'meta'    => $meta ? wp_json_encode( $meta ) : null,
				'is_read' => 0,
			]
		);

		wp_cache_flush_group( 'softtent-todox' );

		return $inserted ? (int) $wpdb->insert_id : false;
	}

	public static function mark_read( int $id, int $user_id ): bool {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$result = (bool) $wpdb->update(
			$wpdb->prefix . self::$table,
			[ 'is_read' => 1 ],
			[
				'id'      => $id,
				'user_id' => $user_id,
			]
		);

		wp_cache_flush_group( 'softtent-todox' );

		return $result;
	}

	public static function mark_all_read( int $user_id ): bool {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$result = (bool) $wpdb->update(
			$wpdb->prefix . self::$table,
			[ 'is_read' => 1 ],
			[
				'user_id' => $user_id,
				'is_read' => 0,
			]
		);

		wp_cache_flush_group( 'softtent-todox' );

		return $result;
	}

	public static function unread_count( int $user_id ): int {
		global $wpdb;

		$cache_key = 'notification_unread_count_' . $user_id;
		$cached    = wp_cache_get( $cache_key, 'softtent-todox' );

		if ( false !== $cached ) {
			return (int) $cached;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$count = (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM %i WHERE user_id = %d AND is_read = 0',
				$wpdb->prefix . self::$table,
				$user_id
			)
		);

		wp_cache_set( $cache_key, $count, 'softtent-todox' );

		return $count;
	}

	public static function format( array $row ): array {
		return [
			'id'         => (int) $row['id'],
			'user_id'    => (int) $row['user_id'],
			'title'      => $row['title'],
			'message'    => $row['message'],
			'type'       => $row['type'],
			'is_read'    => (bool) $row['is_read'],
			'link'       => $row['link'],
			'meta'       => $row['meta'] ? json_decode( $row['meta'], true ) : null,
			'created_at' => Fns::format_datetime( $row['created_at'] ),
		];
	}
}
