<?php

namespace SoftTent\TodoX\Models;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Helpers\Fns;

/**
 * TaskComment model.
 *
 * Direct database queries are used throughout this class because:
 * 1. These are custom tables not managed by WordPress core
 * 2. No alternative WordPress API exists for querying custom table data
 * 3. All queries use $wpdb->prepare() with proper placeholders for security
 *
 * @since 0.1.0
 */
class TaskComment {

	private static string $table = 'st_todox_task_comments';

	public static function get_all( int $task_id ): array {
		global $wpdb;

		$cache_key = 'task_comments_' . $task_id;
		$cached    = wp_cache_get( $cache_key, 'softtent-todox' );

		if ( false !== $cached ) {
			return $cached;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM %i WHERE task_id = %d ORDER BY created_at ASC',
				$wpdb->prefix . self::$table,
				$task_id
			),
			ARRAY_A
		);

		$result = array_map( [ self::class, 'format' ], $rows ?? [] );
		wp_cache_set( $cache_key, $result, 'softtent-todox' );

		return $result;
	}

	public static function create( int $task_id, int $author_id, string $content ): int|false {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$inserted = $wpdb->insert(
			$wpdb->prefix . self::$table,
			[
				'task_id'   => $task_id,
				'author_id' => $author_id,
				'content'   => wp_kses_post( $content ),
			]
		);

		if ( ! $inserted ) {
			return false;
		}

		$comment_id = (int) $wpdb->insert_id;

		TaskActivity::log( $task_id, $author_id, 'comment_added', null );
		wp_cache_flush_group( 'softtent-todox' );

		return $comment_id;
	}

	public static function update( int $id, string $content, int $author_id ): bool {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$result = (bool) $wpdb->update(
			$wpdb->prefix . self::$table,
			[ 'content' => wp_kses_post( $content ) ],
			[
				'id' => $id,
				'author_id' => $author_id,
			]
		);

		wp_cache_flush_group( 'softtent-todox' );

		return $result;
	}

	public static function delete( int $id, int $author_id ): bool {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$result = (bool) $wpdb->delete(
			$wpdb->prefix . self::$table,
			[
				'id' => $id,
				'author_id' => $author_id,
			]
		);

		wp_cache_flush_group( 'softtent-todox' );

		return $result;
	}

	public static function format( array $row ): array {
		return [
			'id'         => (int) $row['id'],
			'task_id'    => (int) $row['task_id'],
			'author_id'  => (int) $row['author_id'],
			'author'     => Fns::get_user_info( (int) $row['author_id'] ),
			'content'    => $row['content'],
			'created_at' => Fns::format_datetime( $row['created_at'] ),
			'updated_at' => Fns::format_datetime( $row['updated_at'] ),
		];
	}
}
