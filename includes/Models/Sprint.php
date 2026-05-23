<?php

namespace SoftTent\TodoX\Models;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Helpers\Fns;

/**
 * Sprint model.
 *
 * Direct database queries are used throughout this class because:
 * 1. These are custom tables not managed by WordPress core
 * 2. No alternative WordPress API exists for querying custom table data
 * 3. All queries use $wpdb->prepare() with proper placeholders for security
 *
 * @since 0.1.0
 */
class Sprint {

	private static string $table = 'st_todox_sprints';

	public static function get_all( int $project_id, array $args = [] ): array {
		global $wpdb;

		$cache_key = 'sprints_' . $project_id . '_' . md5( wp_json_encode( $args ) );
		$cached    = wp_cache_get( $cache_key, 'softtent-todox' );

		if ( false !== $cached ) {
			return $cached;
		}

		$table_sprints  = $wpdb->prefix . self::$table;
		$table_projects = $wpdb->prefix . 'st_todox_projects';
		$table_tasks    = $wpdb->prefix . 'st_todox_tasks';

		$table_tax = $wpdb->prefix . 'st_todox_taxonomies';

		if ( ! empty( $args['status'] ) ) {
			$status_slug = sanitize_key( $args['status'] );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT s.*, p.name as project_name, p.color as project_color, (SELECT COUNT(*) FROM %i WHERE sprint_id = s.id) as tasks_count FROM %i s LEFT JOIN %i p ON p.id = s.project_id WHERE s.project_id = %d AND s.status_id IN (SELECT id FROM %i WHERE type = %s AND slug = %s AND is_active = 1) ORDER BY s.position ASC, s.created_at DESC',
					$table_tasks,
					$table_sprints,
					$table_projects,
					$project_id,
					$table_tax,
					'sprint_status',
					$status_slug
				),
				ARRAY_A
			);
		} else {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT s.*, p.name as project_name, p.color as project_color, (SELECT COUNT(*) FROM %i WHERE sprint_id = s.id) as tasks_count FROM %i s LEFT JOIN %i p ON p.id = s.project_id WHERE s.project_id = %d ORDER BY s.position ASC, s.created_at DESC',
					$table_tasks,
					$table_sprints,
					$table_projects,
					$project_id
				),
				ARRAY_A
			);
		}

		$result = array_map( [ self::class, 'format' ], $rows ?? [] );
		wp_cache_set( $cache_key, $result, 'softtent-todox' );

		return $result;
	}

	public static function get( int $id ): ?array {
		global $wpdb;

		$cache_key = 'sprint_' . $id;
		$cached    = wp_cache_get( $cache_key, 'softtent-todox' );

		if ( false !== $cached ) {
			return $cached ? $cached : null;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT s.*, p.name as project_name, p.color as project_color
				FROM %i s
				LEFT JOIN %i p ON p.id = s.project_id
				WHERE s.id = %d',
				$wpdb->prefix . self::$table,
				$wpdb->prefix . 'st_todox_projects',
				$id
			),
			ARRAY_A
		);

		$result = $row ? self::format( $row ) : null;
		wp_cache_set( $cache_key, $result ? $result : false, 'softtent-todox' );

		return $result;
	}

	public static function create( array $data ): int|false {
		global $wpdb;

		$status_id = ! empty( $data['status_id'] )
			? (int) $data['status_id']
			: self::resolve_status_id( self::sanitize_status( $data['status'] ?? 'planned' ) );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		$inserted = $wpdb->insert(
			$wpdb->prefix . self::$table,
			[
				'project_id' => (int) $data['project_id'],
				'name'       => sanitize_text_field( $data['name'] ),
				'goal'       => isset( $data['goal'] ) ? wp_kses_post( $data['goal'] ) : null,
				'status_id'  => $status_id,
				'start_date' => $data['start_date'] ?? null,
				'end_date'   => $data['end_date'] ?? null,
			]
		);

		wp_cache_flush_group( 'softtent-todox' );

		return $inserted ? (int) $wpdb->insert_id : false;
	}

	public static function update( int $id, array $data ): bool {
		global $wpdb;

		$update = [];

		if ( isset( $data['name'] ) ) {
			$update['name'] = sanitize_text_field( $data['name'] );
		}
		if ( isset( $data['goal'] ) ) {
			$update['goal'] = wp_kses_post( $data['goal'] );
		}
		if ( isset( $data['status'] ) ) {
			$update['status_id'] = self::resolve_status_id( self::sanitize_status( (string) $data['status'] ) );
		}
		if ( isset( $data['status_id'] ) ) {
			$update['status_id'] = $data['status_id'] ? (int) $data['status_id'] : null;
		}
		if ( isset( $data['start_date'] ) ) {
			$update['start_date'] = ! empty( $data['start_date'] ) ? $data['start_date'] : null;
		}
		if ( isset( $data['end_date'] ) ) {
			$update['end_date'] = ! empty( $data['end_date'] ) ? $data['end_date'] : null;
		}

		if ( empty( $update ) ) {
			return false;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		$result = (bool) $wpdb->update( $wpdb->prefix . self::$table, $update, [ 'id' => $id ] );
		wp_cache_flush_group( 'softtent-todox' );

		return $result;
	}

	public static function delete( int $id ): bool {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		$result = (bool) $wpdb->delete( $wpdb->prefix . self::$table, [ 'id' => $id ] );
		wp_cache_flush_group( 'softtent-todox' );

		return $result;
	}

	public static function get_workspace_id( int $id ): ?int {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$val = $wpdb->get_var(
			$wpdb->prepare(
				'SELECT p.workspace_id FROM %i s JOIN %i p ON p.id = s.project_id WHERE s.id = %d',
				$wpdb->prefix . self::$table,
				$wpdb->prefix . 'st_todox_projects',
				$id
			)
		);
		return $val !== null ? (int) $val : null;
	}

	public static function reorder( array $items ): void {
		global $wpdb;

		foreach ( $items as $item ) {
			$id  = isset( $item['id'] ) ? (int) $item['id'] : 0;
			$pos = isset( $item['position'] ) ? (int) $item['position'] : 0;
			if ( $id <= 0 ) {
				continue;
			}
			$wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
				$wpdb->prefix . self::$table,
				[ 'position' => $pos ],
				[ 'id' => $id ],
				[ '%d' ],
				[ '%d' ]
			);
		}

		wp_cache_flush_group( 'softtent-todox' );
	}

	public static function get_active( int $project_id ): ?array {
		global $wpdb;

		$cache_key = 'sprint_active_' . $project_id;
		$cached    = wp_cache_get( $cache_key, 'softtent-todox' );

		if ( false !== $cached ) {
			return $cached ? $cached : null;
		}

		$tax_table = $wpdb->prefix . 'st_todox_taxonomies';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT s.* FROM %i s WHERE s.project_id = %d AND s.status_id IN ( SELECT id FROM %i WHERE type = %s AND slug = %s AND is_active = 1 ) ORDER BY s.created_at DESC LIMIT 1',
				$wpdb->prefix . self::$table,
				$project_id,
				$tax_table,
				'sprint_status',
				'active'
			),
			ARRAY_A
		);

		$result = $row ? self::format( $row ) : null;
		wp_cache_set( $cache_key, $result ? $result : false, 'softtent-todox' );

		return $result;
	}

	public static function format( array $row ): array {
		$status_id = isset( $row['status_id'] ) && $row['status_id'] ? (int) $row['status_id'] : null;
		$status    = $status_id ? self::resolve_status_slug( $status_id ) : 'planned';

		return [
			'id'          => (int) $row['id'],
			'project_id'  => (int) $row['project_id'],
			'name'        => $row['name'],
			'goal'        => $row['goal'],
			'status_id'   => $status_id,
			'status'      => $status,
			'start_date'  => $row['start_date'],
			'end_date'    => $row['end_date'],
			'project'     => [
				'id'    => (int) $row['project_id'],
				'name'  => $row['project_name'] ?? '',
				'color' => $row['project_color'] ?? '#6366f1',
			],
			'tasks_count' => (int) ( $row['tasks_count'] ?? 0 ),
			'created_at'  => Fns::format_datetime( $row['created_at'] ),
			'updated_at'  => Fns::format_datetime( $row['updated_at'] ),
		];
	}

	private static function sanitize_status( string $status ): string {
		$slug = strtolower( trim( preg_replace( '/[^a-z0-9_]+/i', '_', $status ) ) );
		return $slug !== '' ? $slug : 'planned';
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
				'sprint_status',
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

		$cache[ $status_id ] = $slug ?? 'planned';
		return $cache[ $status_id ];
	}
}
