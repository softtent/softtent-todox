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

		$conditions = [ 'p.workspace_id = %d' ];
		$values     = [ $workspace_id ];

		if ( ! empty( $args['team_id'] ) ) {
			$conditions[] = 'EXISTS (SELECT 1 FROM `' . $wpdb->prefix . 'st_todox_relations` pt2 WHERE pt2.relatable_id = p.id AND pt2.relatable_type = \'project\' AND pt2.relation_id = %d)';
			$values[]     = (int) $args['team_id'];
		}

		if ( ! empty( $args['status'] ) ) {
			$sid = self::resolve_status_id( sanitize_key( $args['status'] ) );
			if ( $sid ) {
				$conditions[] = 'p.status_id = %d';
				$values[]     = $sid;
			}
		}

		if ( ! empty( $args['search'] ) ) {
			$conditions[] = 'p.name LIKE %s';
			$values[]     = '%' . $wpdb->esc_like( sanitize_text_field( $args['search'] ) ) . '%';
		}

		$where    = implode( ' AND ', $conditions );
		$values[] = (int) ( $args['per_page'] ?? 100 );
		$values[] = (int) ( $args['offset'] ?? 0 );

		$query = "SELECT p.*,
					(SELECT COUNT(*) FROM `{$table_sprints}` WHERE project_id = p.id) as sprints_count
				FROM `{$table_projects}` p
				WHERE {$where}
				ORDER BY p.position ASC, p.created_at DESC
				LIMIT %d OFFSET %d"; // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

		// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			$wpdb->prepare( $query, ...$values ), // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			ARRAY_A
		);

		if ( empty( $rows ) ) {
			return [];
		}

		$project_ids = array_column( $rows, 'id' );
		$teams_map   = self::get_teams_for_projects( $project_ids );

		return array_map(
			function ( $row ) use ( $teams_map ) {
				return self::format( $row, $teams_map[ (int) $row['id'] ] ?? [] );
			},
			$rows
		);
	}

	public static function get( int $id ): ?array {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT p.* FROM %i p WHERE p.id = %d',
				$wpdb->prefix . self::$table,
				$id
			),
			ARRAY_A
		);

		if ( ! $row ) {
			return null;
		}

		$teams = self::get_teams_for_projects( [ $id ] );
		return self::format( $row, $teams[ $id ] ?? [] );
	}

	public static function create( array $data ): int|false {
		global $wpdb;

		$status_id = ! empty( $data['status_id'] )
			? (int) $data['status_id']
			: self::resolve_status_id( self::sanitize_status( $data['status'] ?? 'active' ) );

		$inserted = $wpdb->insert( // phpcs:ignore
			$wpdb->prefix . self::$table,
			[
				'workspace_id' => (int) $data['workspace_id'],
				'name'         => sanitize_text_field( $data['name'] ),
				'description'  => isset( $data['description'] ) ? wp_kses_post( $data['description'] ) : null,
				'color'        => Fns::sanitize_color( $data['color'] ?? '#6366f1' ),
				'icon'         => isset( $data['icon'] ) ? sanitize_text_field( $data['icon'] ) : null,
				'status_id'    => $status_id,
				'owner_id'     => (int) $data['owner_id'],
			]
		);

		if ( ! $inserted ) {
			return false;
		}

		$project_id = (int) $wpdb->insert_id;

		if ( ! empty( $data['team_ids'] ) && is_array( $data['team_ids'] ) ) {
			self::sync_teams( $project_id, $data['team_ids'] );
		}

		return $project_id;
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
			$update['status_id'] = self::resolve_status_id( self::sanitize_status( (string) $data['status'] ) );
		}
		if ( isset( $data['status_id'] ) ) {
			$update['status_id'] = $data['status_id'] ? (int) $data['status_id'] : null;
		}

		if ( ! empty( $data['team_ids'] ) && is_array( $data['team_ids'] ) ) {
			self::sync_teams( $id, $data['team_ids'] );
		}

		if ( empty( $update ) ) {
			return true;
		}

		return (bool) $wpdb->update( $wpdb->prefix . self::$table, $update, [ 'id' => $id ] ); // phpcs:ignore
	}

	public static function delete( int $id ): bool {
		global $wpdb;

		// Delete relation rows for this project.
		$wpdb->delete( $wpdb->prefix . 'st_todox_relations', [ 'relatable_id' => $id, 'relatable_type' => 'project' ] ); // phpcs:ignore

		return (bool) $wpdb->delete( $wpdb->prefix . self::$table, [ 'id' => $id ] ); // phpcs:ignore
	}

	public static function count( int $workspace_id ): int {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM %i WHERE workspace_id = %d',
				$wpdb->prefix . self::$table,
				$workspace_id
			)
		);
	}

	public static function get_workspace_id( int $id ): ?int {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$val = $wpdb->get_var( $wpdb->prepare( 'SELECT workspace_id FROM %i WHERE id = %d', $wpdb->prefix . self::$table, $id ) );
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
	}

	public static function format( array $row, array $teams = [] ): array {
		$status_id = isset( $row['status_id'] ) && $row['status_id'] ? (int) $row['status_id'] : null;
		$status    = $status_id ? self::resolve_status_slug( $status_id ) : 'active';

		return [
			'id'            => (int) $row['id'],
			'workspace_id'  => (int) $row['workspace_id'],
			'name'          => $row['name'],
			'description'   => $row['description'],
			'color'         => $row['color'],
			'icon'          => $row['icon'],
			'status_id'     => $status_id,
			'status'        => $status,
			'owner_id'      => (int) $row['owner_id'],
			'owner'         => Fns::get_user_info( (int) $row['owner_id'] ),
			'teams'         => $teams,
			'team_ids'      => array_column( $teams, 'id' ),
			'sprints_count' => (int) ( $row['sprints_count'] ?? 0 ),
			'created_at'    => Fns::format_datetime( $row['created_at'] ),
			'updated_at'    => Fns::format_datetime( $row['updated_at'] ),
		];
	}

	/**
	 * Replace all team assignments for a project.
	 */
	private static function sync_teams( int $project_id, array $team_ids ): void {
		global $wpdb;

		$pivot = $wpdb->prefix . 'st_todox_relations';

		$wpdb->delete( $pivot, [ 'relatable_id' => $project_id, 'relatable_type' => 'project' ] ); // phpcs:ignore

		foreach ( $team_ids as $team_id ) {
			$team_id = (int) $team_id;
			if ( $team_id > 0 ) {
				$wpdb->insert( // phpcs:ignore
					$pivot,
					[
						'relation_id'    => $team_id,
						'relatable_id'   => $project_id,
						'relatable_type' => 'project',
					]
				);
			}
		}
	}

	/**
	 * Load teams for multiple projects in one query, keyed by project_id.
	 *
	 * @param int[] $project_ids
	 * @return array<int, array[]>
	 */
	private static function get_teams_for_projects( array $project_ids ): array {
		global $wpdb;

		if ( empty( $project_ids ) ) {
			return [];
		}

		$pivot       = $wpdb->prefix . 'st_todox_relations';
		$table_teams = $wpdb->prefix . 'st_todox_teams';
		$table_depts = $wpdb->prefix . 'st_todox_departments';

		$id_list = implode( ',', array_map( 'intval', $project_ids ) );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT pt.relatable_id as project_id, t.id, t.name, t.color,
					(SELECT d.name FROM %i tdp
					 JOIN %i d ON d.id = tdp.relatable_id
					 WHERE tdp.relation_id = t.id AND tdp.relatable_type = %s
					 ORDER BY d.name ASC LIMIT 1) as dept_name
				FROM %i pt
				JOIN %i t ON t.id = pt.relation_id
				WHERE pt.relatable_type = %s AND FIND_IN_SET(pt.relatable_id, %s)',
				$pivot,
				$table_depts,
				'department',
				$pivot,
				$table_teams,
				'project',
				$id_list
			),
			ARRAY_A
		);

		$map = [];
		foreach ( $rows as $row ) {
			$pid           = (int) $row['project_id'];
			$map[ $pid ][] = [
				'id'         => (int) $row['id'],
				'name'       => $row['name'],
				'color'      => $row['color'],
				'department' => [ 'name' => $row['dept_name'] ?? '' ],
			];
		}

		return $map;
	}

	private static function sanitize_status( string $status ): string {
		$slug = strtolower( trim( preg_replace( '/[^a-z0-9_]+/i', '_', $status ) ) );
		return $slug !== '' ? $slug : 'active';
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
				'project_status',
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

		$cache[ $status_id ] = $slug ?? 'active';
		return $cache[ $status_id ];
	}
}
