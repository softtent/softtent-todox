<?php

namespace SoftTent\TodoX\Models;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Helpers\Fns;

/**
 * TaskActivity model.
 *
 * Direct database queries are used throughout this class because:
 * 1. These are custom tables not managed by WordPress core
 * 2. No alternative WordPress API exists for querying custom table data
 * 3. All queries use $wpdb->prepare() with proper placeholders for security
 *
 * @since 0.1.0
 */
class TaskActivity {

	private static string $table = 'st_todox_task_activities';

	public static function get_all( int $task_id, int $limit = 50 ): array {
		global $wpdb;

		$cache_key = 'task_activities_' . $task_id . '_' . $limit;
		$cached    = wp_cache_get( $cache_key, 'softtent-todox' );

		if ( false !== $cached ) {
			return $cached;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM %i WHERE task_id = %d ORDER BY created_at DESC LIMIT %d',
				$wpdb->prefix . self::$table,
				$task_id,
				$limit
			),
			ARRAY_A
		);

		$result = array_map( [ self::class, 'format' ], $rows ?? [] );
		wp_cache_set( $cache_key, $result, 'softtent-todox' );

		return $result;
	}

	public static function log( int $task_id, int $user_id, string $action, ?string $detail ): void {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->insert(
			$wpdb->prefix . self::$table,
			[
				'task_id' => $task_id,
				'user_id' => $user_id,
				'action'  => sanitize_text_field( $action ),
				'detail'  => $detail ? sanitize_text_field( $detail ) : null,
			]
		);

		wp_cache_flush_group( 'softtent-todox' );
	}

	public static function format( array $row ): array {
		return [
			'id'         => (int) $row['id'],
			'task_id'    => (int) $row['task_id'],
			'user_id'    => (int) $row['user_id'],
			'user'       => Fns::get_user_info( (int) $row['user_id'] ),
			'action'     => $row['action'],
			'detail'     => $row['detail'],
			'created_at' => Fns::format_datetime( $row['created_at'] ),
		];
	}
}
