<?php

namespace SoftTent\TodoX\Models;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Helpers\Fns;

/**
 * Subtask model.
 *
 * Direct database queries are used throughout this class because:
 * 1. These are custom tables not managed by WordPress core
 * 2. No alternative WordPress API exists for querying custom table data
 * 3. All queries use $wpdb->prepare() with proper placeholders for security
 *
 * @since 0.1.0
 */
class Subtask {

	private static string $table = 'st_todox_subtasks';

	public static function get_all( int $task_id ): array {
		global $wpdb;

		$cache_key = 'subtasks_' . $task_id;
		$cached    = wp_cache_get( $cache_key, 'softtent-todox' );

		if ( false !== $cached ) {
			return $cached;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM %i WHERE task_id = %d ORDER BY position ASC',
				$wpdb->prefix . self::$table,
				$task_id
			),
			ARRAY_A
		);

		$result = array_map( [ self::class, 'format' ], $rows ?? [] );
		wp_cache_set( $cache_key, $result, 'softtent-todox' );

		return $result;
	}

	public static function get( int $id ): ?array {
		global $wpdb;

		$cache_key = 'subtask_' . $id;
		$cached    = wp_cache_get( $cache_key, 'softtent-todox' );

		if ( false !== $cached ) {
			return $cached ? $cached : null;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM %i WHERE id = %d',
				$wpdb->prefix . self::$table,
				$id
			),
			ARRAY_A
		);

		$result = $row ? self::format( $row ) : null;
		wp_cache_set( $cache_key, $result ? $result : false, 'softtent-todox' );

		return $result;
	}

	public static function create( int $task_id, array $data ): int|false {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$position = 1 + (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT MAX(position) FROM %i WHERE task_id = %d',
				$wpdb->prefix . self::$table,
				$task_id
			)
		);

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$inserted = $wpdb->insert(
			$wpdb->prefix . self::$table,
			[
				'task_id'    => $task_id,
				'title'      => sanitize_text_field( $data['title'] ),
				'description' => isset( $data['description'] ) ? wp_kses_post( $data['description'] ) : null,
				'status'     => in_array( $data['status'] ?? '', [ 'todo', 'in_progress', 'done' ], true ) ? $data['status'] : 'todo',
				'priority'   => in_array( $data['priority'] ?? '', [ 'low', 'medium', 'high', 'urgent' ], true ) ? $data['priority'] : 'medium',
				'due_date'   => $data['due_date'] ?? null,
				'completed'  => isset( $data['completed'] ) ? (int) $data['completed'] : 0,
				'position'   => $position,
				'assignee_id' => isset( $data['assignee_id'] ) ? (int) $data['assignee_id'] : null,
				'taxonomy_id' => isset( $data['taxonomy_id'] ) ? (int) $data['taxonomy_id'] : null,
			]
		);

		wp_cache_flush_group( 'softtent-todox' );

		return $inserted ? (int) $wpdb->insert_id : false;
	}

	public static function update( int $id, array $data ): bool {
		global $wpdb;

		$allowed = [ 'title', 'description', 'status', 'priority', 'due_date', 'completed', 'position', 'assignee_id', 'taxonomy_id' ];
		$update  = [];

		foreach ( $allowed as $field ) {
			if ( ! array_key_exists( $field, $data ) ) {
				continue;
			}
			$update[ $field ] = match ( $field ) {
				'title'       => sanitize_text_field( $data[ $field ] ),
				'description' => wp_kses_post( $data[ $field ] ),
				'status'      => ( in_array( $data[ $field ], [ 'todo', 'in_progress', 'done' ], true ) ? $data[ $field ] : 'todo' ),
				'priority'    => ( in_array( $data[ $field ], [ 'low', 'medium', 'high', 'urgent' ], true ) ? $data[ $field ] : 'medium' ),
				'completed'   => (int) $data[ $field ],
				'assignee_id',
				'taxonomy_id',
				'position'    => ( $data[ $field ] !== null ? (int) $data[ $field ] : null ),
				default       => $data[ $field ],
			};
		}

		if ( empty( $update ) ) {
			return false;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$result = (bool) $wpdb->update(
			$wpdb->prefix . self::$table,
			$update,
			[ 'id' => $id ]
		);

		wp_cache_flush_group( 'softtent-todox' );

		return $result;
	}

	public static function delete( int $id ): bool {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$result = (bool) $wpdb->delete(
			$wpdb->prefix . self::$table,
			[ 'id' => $id ]
		);

		wp_cache_flush_group( 'softtent-todox' );

		return $result;
	}

	public static function format( array $row ): array {
		return [
			'id'          => (int) $row['id'],
			'task_id'     => (int) $row['task_id'],
			'title'       => $row['title'],
			'description' => $row['description'],
			'status'      => $row['status'],
			'taxonomy_id' => $row['taxonomy_id'] ? (int) $row['taxonomy_id'] : null,
			'priority'    => $row['priority'],
			'due_date'    => $row['due_date'],
			'completed'   => (bool) $row['completed'],
			'position'    => (int) $row['position'],
			'assignee_id' => $row['assignee_id'] ? (int) $row['assignee_id'] : null,
			'assignee'    => $row['assignee_id'] ? Fns::get_user_info( (int) $row['assignee_id'] ) : null,
			'labels'      => [],
			'created_at'  => Fns::format_datetime( $row['created_at'] ),
			'updated_at'  => Fns::format_datetime( $row['updated_at'] ),
		];
	}
}
