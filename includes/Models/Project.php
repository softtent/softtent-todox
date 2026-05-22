<?php

namespace SoftTent\TodoX\Models;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Helpers\Fns;

/**
 * Project model.
 *
 * Direct database queries are used throughout this class because:
 * 1. These are custom tables not managed by WordPress core
 * 2. No alternative WordPress API exists for querying custom table data
 * 3. All queries use $wpdb->prepare() with proper placeholders for security
 *
 * @since 0.1.0
 */
class Project {

	private static string $table = 'st_todox_projects';

	public static function get_all( int $workspace_id, array $args = [] ): array {
		global $wpdb;

		$table_projects = $wpdb->prefix . self::$table;
		$table_sprints  = $wpdb->prefix . 'st_todox_sprints';
		$table_teams    = $wpdb->prefix . 'st_todox_teams';
		$table_depts    = $wpdb->prefix . 'st_todox_departments';

		$conditions = [ 'p.workspace_id = %d' ];
		$values     = [ $workspace_id ];

		if ( ! empty( $args['team_id'] ) ) {
			$conditions[] = 'p.team_id = %d';
			$values[]     = (int) $args['team_id'];
		}

		if ( ! empty( $args['status'] ) ) {
			$conditions[] = 'p.status = %s';
			$values[]     = sanitize_text_field( $args['status'] );
		}

		if ( ! empty( $args['search'] ) ) {
			$conditions[] = 'p.name LIKE %s';
			$values[]     = '%' . $wpdb->esc_like( sanitize_text_field( $args['search'] ) ) . '%';
		}

		$where    = implode( ' AND ', $conditions );
		$values[] = (int) ( $args['per_page'] ?? 100 );
		$values[] = (int) ( $args['offset'] ?? 0 );

		// Build query with escaped table identifiers.
		$query = "SELECT p.*, t.name as team_name, t.color as team_color, d.name as dept_name,
					(SELECT COUNT(*) FROM `{$table_sprints}` WHERE project_id = p.id) as sprints_count
				FROM `{$table_projects}` p
				LEFT JOIN `{$table_teams}` t ON t.id = p.team_id
				LEFT JOIN `{$table_depts}` d ON d.id = t.department_id
				WHERE {$where}
				ORDER BY p.created_at DESC
				LIMIT %d OFFSET %d"; // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

		// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			$wpdb->prepare( $query, ...$values ), // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			ARRAY_A
		);

		return array_map( [ self::class, 'format' ], $rows ?? [] );
	}

	public static function get( int $id ): ?array {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT p.*, t.name as team_name, t.color as team_color, d.name as dept_name
				FROM %i p
				LEFT JOIN %i t ON t.id = p.team_id
				LEFT JOIN %i d ON d.id = t.department_id
				WHERE p.id = %d',
				$wpdb->prefix . self::$table,
				$wpdb->prefix . 'st_todox_teams',
				$wpdb->prefix . 'st_todox_departments',
				$id
			),
			ARRAY_A
		);

		return $row ? self::format( $row ) : null;
	}

	public static function create( array $data ): int|false {
		global $wpdb;

		$inserted = $wpdb->insert( // phpcs:ignore
			$wpdb->prefix . self::$table,
			[
				'team_id'      => (int) $data['team_id'],
				'workspace_id' => (int) $data['workspace_id'],
				'name'         => sanitize_text_field( $data['name'] ),
				'description'  => isset( $data['description'] ) ? wp_kses_post( $data['description'] ) : null,
				'color'        => Fns::sanitize_color( $data['color'] ?? '#6366f1' ),
				'icon'         => isset( $data['icon'] ) ? sanitize_text_field( $data['icon'] ) : null,
				'status'       => in_array( $data['status'] ?? 'active', [ 'active', 'completed', 'archived' ], true ) ? $data['status'] : 'active',
				'owner_id'     => (int) $data['owner_id'],
				'taxonomy_id'  => isset( $data['taxonomy_id'] ) ? (int) $data['taxonomy_id'] : null,
			]
		);

		return $inserted ? (int) $wpdb->insert_id : false;
	}

	public static function update( int $id, array $data ): bool {
		global $wpdb;

		$update = [];

		if ( isset( $data['name'] ) ) {
			$update['name'] = sanitize_text_field( $data['name'] );
        }
		if ( isset( $data['description'] ) ) {
			$update['description'] = wp_kses_post( $data['description'] );
        }
		if ( isset( $data['color'] ) ) {
			$update['color'] = Fns::sanitize_color( $data['color'] );
        }
		if ( isset( $data['icon'] ) ) {
			$update['icon'] = sanitize_text_field( $data['icon'] );
        }
		if ( isset( $data['status'] ) ) {
			$update['status'] = in_array( $data['status'], [ 'active', 'completed', 'archived' ], true ) ? $data['status'] : 'active';
        }
		if ( isset( $data['taxonomy_id'] ) ) {
			$update['taxonomy_id'] = (int) $data['taxonomy_id'];
        }

		if ( empty( $update ) ) {
			return false;
        }

		return (bool) $wpdb->update( $wpdb->prefix . self::$table, $update, [ 'id' => $id ] ); // phpcs:ignore
	}

	public static function delete( int $id ): bool {
		global $wpdb;

		return (bool) $wpdb->delete( $wpdb->prefix . self::$table, [ 'id' => $id ] ); // phpcs:ignore
	}

	public static function format( array $row ): array {
		return [
			'id'            => (int) $row['id'],
			'team_id'       => (int) $row['team_id'],
			'workspace_id'  => (int) $row['workspace_id'],
			'name'          => $row['name'],
			'description'   => $row['description'],
			'color'         => $row['color'],
			'icon'          => $row['icon'],
			'status'        => $row['status'],
			'taxonomy_id'   => $row['taxonomy_id'] ? (int) $row['taxonomy_id'] : null,
			'owner_id'      => (int) $row['owner_id'],
			'owner'         => Fns::get_user_info( (int) $row['owner_id'] ),
			'team'          => [
				'id'    => (int) $row['team_id'],
				'name'  => $row['team_name'] ?? '',
				'color' => $row['team_color'] ?? '#6366f1',
				'department' => [ 'name' => $row['dept_name'] ?? '' ],
			],
			'sprints_count' => (int) ( $row['sprints_count'] ?? 0 ),
			'created_at'    => Fns::format_datetime( $row['created_at'] ),
			'updated_at'    => Fns::format_datetime( $row['updated_at'] ),
		];
	}
}
