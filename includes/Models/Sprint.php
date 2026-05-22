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

		if ( ! empty( $args['status'] ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT s.*, p.name as project_name, p.color as project_color,
					(SELECT COUNT(*) FROM %i WHERE sprint_id = s.id) as tasks_count
					FROM %i s
					LEFT JOIN %i p ON p.id = s.project_id
					WHERE s.project_id = %d AND s.status = %s
					ORDER BY s.created_at DESC',
					$table_sprints,
					$table_tasks,
					$table_projects,
					$project_id,
					sanitize_text_field( $args['status'] )
				),
				ARRAY_A
			);
		} else {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT s.*, p.name as project_name, p.color as project_color,
					(SELECT COUNT(*) FROM %i WHERE sprint_id = s.id) as tasks_count
					FROM %i s
					LEFT JOIN %i p ON p.id = s.project_id
					WHERE s.project_id = %d
					ORDER BY s.created_at DESC',
					$table_sprints,
					$table_tasks,
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

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		$inserted = $wpdb->insert(
			$wpdb->prefix . self::$table,
			[
				'project_id'  => (int) $data['project_id'],
				'name'        => sanitize_text_field( $data['name'] ),
				'goal'        => isset( $data['goal'] ) ? wp_kses_post( $data['goal'] ) : null,
				'status'      => in_array( $data['status'] ?? 'planned', [ 'planned', 'active', 'completed' ], true ) ? ( $data['status'] ?? 'planned' ) : 'planned',
				'taxonomy_id' => isset( $data['taxonomy_id'] ) ? (int) $data['taxonomy_id'] : null,
				'start_date'  => $data['start_date'] ?? null,
				'end_date'    => $data['end_date'] ?? null,
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
			$update['status'] = in_array( $data['status'], [ 'planned', 'active', 'completed' ], true ) ? $data['status'] : 'planned';
		}
		if ( isset( $data['start_date'] ) ) {
			$update['start_date'] = ! empty( $data['start_date'] ) ? $data['start_date'] : null;
		}
		if ( isset( $data['end_date'] ) ) {
			$update['end_date'] = ! empty( $data['end_date'] ) ? $data['end_date'] : null;
		}
		if ( isset( $data['taxonomy_id'] ) ) {
			$update['taxonomy_id'] = (int) $data['taxonomy_id'];
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

	public static function get_active( int $project_id ): ?array {
		global $wpdb;

		$cache_key = 'sprint_active_' . $project_id;
		$cached    = wp_cache_get( $cache_key, 'softtent-todox' );

		if ( false !== $cached ) {
			return $cached ? $cached : null;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM %i WHERE project_id = %d AND status = 'active' ORDER BY created_at DESC LIMIT 1",
				$wpdb->prefix . self::$table,
				$project_id
			),
			ARRAY_A
		);

		$result = $row ? self::format( $row ) : null;
		wp_cache_set( $cache_key, $result ? $result : false, 'softtent-todox' );

		return $result;
	}

	public static function format( array $row ): array {
		return [
			'id'           => (int) $row['id'],
			'project_id'   => (int) $row['project_id'],
			'name'         => $row['name'],
			'goal'         => $row['goal'],
			'status'       => $row['status'],
			'taxonomy_id'  => $row['taxonomy_id'] ? (int) $row['taxonomy_id'] : null,
			'start_date'   => $row['start_date'],
			'end_date'     => $row['end_date'],
			'project'      => [
				'id'    => (int) $row['project_id'],
				'name'  => $row['project_name'] ?? '',
				'color' => $row['project_color'] ?? '#6366f1',
			],
			'tasks_count'  => (int) ( $row['tasks_count'] ?? 0 ),
			'created_at'   => Fns::format_datetime( $row['created_at'] ),
			'updated_at'   => Fns::format_datetime( $row['updated_at'] ),
		];
	}
}
