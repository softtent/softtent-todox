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

		$status_id = ! empty( $data['status_id'] )
			? (int) $data['status_id']
			: self::resolve_status_id( self::sanitize_status( $data['status'] ?? 'todo' ) );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$inserted = $wpdb->insert(
			$wpdb->prefix . self::$table,
			[
				'task_id'     => $task_id,
				'title'       => sanitize_text_field( $data['title'] ),
				'description' => isset( $data['description'] ) ? wp_kses_post( $data['description'] ) : null,
				'status_id'   => $status_id,
				'priority'    => in_array( $data['priority'] ?? '', [ 'low', 'medium', 'high', 'urgent' ], true ) ? $data['priority'] : 'medium',
				'start_date'  => $data['start_date'] ?? null,
				'due_date'    => $data['due_date'] ?? null,
				'completed'   => isset( $data['completed'] ) ? (int) $data['completed'] : 0,
				'position'    => $position,
				'assignee_id' => isset( $data['assignee_id'] ) ? (int) $data['assignee_id'] : null,
				'label_ids'   => self::encode_label_ids( $data['label_ids'] ?? [] ),
			]
		);

		wp_cache_flush_group( 'softtent-todox' );

		return $inserted ? (int) $wpdb->insert_id : false;
	}

	public static function update( int $id, array $data ): bool {
		global $wpdb;

		$allowed = [ 'title', 'description', 'status', 'status_id', 'priority', 'start_date', 'due_date', 'completed', 'position', 'assignee_id', 'label_ids' ];
		$update  = [];

		foreach ( $allowed as $field ) {
			if ( ! array_key_exists( $field, $data ) ) {
				continue;
			}
			switch ( $field ) {
				case 'title':
					$update['title'] = sanitize_text_field( $data[ $field ] );
					break;
				case 'description':
					$update['description'] = wp_kses_post( $data[ $field ] );
					break;
				case 'status':
					$update['status_id'] = self::resolve_status_id( self::sanitize_status( (string) $data[ $field ] ) );
					break;
				case 'status_id':
					$update['status_id'] = $data[ $field ] !== null ? (int) $data[ $field ] : null;
					break;
				case 'priority':
					$update['priority'] = in_array( $data[ $field ], [ 'low', 'medium', 'high', 'urgent' ], true ) ? $data[ $field ] : 'medium';
					break;
				case 'completed':
					$update['completed'] = (int) $data[ $field ];
					break;
				case 'assignee_id':
				case 'position':
					$update[ $field ] = $data[ $field ] !== null ? (int) $data[ $field ] : null;
					break;
				case 'label_ids':
					$update['label_ids'] = self::encode_label_ids( $data[ $field ] );
					break;
				default:
					$update[ $field ] = $data[ $field ];
			}
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

	public static function reorder( array $items ): void {
		global $wpdb;
		$table = $wpdb->prefix . self::$table;

		foreach ( $items as $item ) {
			$id       = (int) ( $item['id'] ?? 0 );
			$position = (int) ( $item['position'] ?? 0 );
			if ( $id > 0 ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
				$wpdb->update( $table, [ 'position' => $position ], [ 'id' => $id ] );
			}
		}

		wp_cache_flush_group( 'softtent-todox' );
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
		$ids       = isset( $row['label_ids'] ) && $row['label_ids'] !== null
			? array_values( array_filter( array_map( 'intval', json_decode( $row['label_ids'], true ) ?? [] ) ) )
			: [];
		$status_id = isset( $row['status_id'] ) && $row['status_id'] ? (int) $row['status_id'] : null;
		$status    = $status_id ? self::resolve_status_slug( $status_id ) : 'todo';

		return [
			'id'          => (int) $row['id'],
			'task_id'     => (int) $row['task_id'],
			'title'       => $row['title'],
			'description' => $row['description'],
			'status_id'   => $status_id,
			'status'      => $status,
			'label_ids'   => $ids,
			'labels'      => Task::resolve_labels( $ids ),
			'priority'    => $row['priority'],
			'start_date'  => $row['start_date'],
			'due_date'    => $row['due_date'],
			'completed'   => (bool) $row['completed'],
			'position'    => (int) $row['position'],
			'assignee_id' => $row['assignee_id'] ? (int) $row['assignee_id'] : null,
			'assignee'    => $row['assignee_id'] ? Fns::get_user_info( (int) $row['assignee_id'] ) : null,
			'created_at'  => Fns::format_datetime( $row['created_at'] ),
			'updated_at'  => Fns::format_datetime( $row['updated_at'] ),
		];
	}

	private static function sanitize_status( string $status ): string {
		$slug = strtolower( trim( preg_replace( '/[^a-z0-9_]+/i', '_', $status ) ) );
		return $slug !== '' ? $slug : 'todo';
	}

	private static function resolve_status_id( string $slug ): ?int {
		static $cache = [];
		if ( array_key_exists( $slug, $cache ) ) {
			return $cache[ $slug ];
		}

		global $wpdb;
		$table = $wpdb->prefix . 'st_todox_taxonomies';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$id = $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM %i WHERE type = %s AND slug = %s AND is_active = 1 ORDER BY workspace_id ASC LIMIT 1',
				$table,
				'subtask_status',
				$slug
			)
		);

		$cache[ $slug ] = $id ? (int) $id : null;
		return $cache[ $slug ];
	}

	private static function resolve_status_slug( int $status_id ): string {
		static $cache = [];
		if ( array_key_exists( $status_id, $cache ) ) {
			return $cache[ $status_id ];
		}

		global $wpdb;
		$table = $wpdb->prefix . 'st_todox_taxonomies';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$slug = $wpdb->get_var(
			$wpdb->prepare(
				'SELECT slug FROM %i WHERE id = %d',
				$table,
				$status_id
			)
		);

		$cache[ $status_id ] = $slug ?? 'todo';
		return $cache[ $status_id ];
	}

	private static function encode_label_ids( mixed $value ): ?string {
		if ( ! is_array( $value ) || empty( $value ) ) {
			return null;
		}
		$ids = array_values( array_filter( array_map( 'intval', $value ) ) );
		return $ids ? wp_json_encode( $ids ) : null;
	}
}
