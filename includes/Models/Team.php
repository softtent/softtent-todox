<?php

namespace SoftTent\TodoX\Models;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Helpers\Fns;

/**
 * Team model.
 *
 * @since 0.1.0
 */
class Team {

	private static string $table         = 'st_todox_teams';
	private static string $pivot         = 'st_todox_relations';
	private static string $members_table = 'st_todox_team_members';

	private static bool $pivot_ready = false;

	/**
	 * Ensure the relations table exists before any pivot-dependent query.
	 * Guards against the rare case where migrations have not yet run.
	 */
	private static function ensure_pivot_table(): void {
		if ( self::$pivot_ready ) {
			return;
		}
		self::$pivot_ready = true;

		global $wpdb;
		$table = $wpdb->prefix . self::$pivot;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) ) {
			return;
		}

		\SoftTent\TodoX\Database\Migrations\CreateRelationsTable::up();
	}

	public static function get_all( int $workspace_id, array $args = [] ): array {
		self::ensure_pivot_table();

		global $wpdb;

		$table_teams   = $wpdb->prefix . self::$table;
		$table_pivot   = $wpdb->prefix . self::$pivot;
		$table_members = $wpdb->prefix . self::$members_table;
		$table_depts   = $wpdb->prefix . 'st_todox_departments';

		$cache_key = 'teams_' . $workspace_id . '_' . md5( wp_json_encode( $args ) );
		$cached    = wp_cache_get( $cache_key, 'softtent-todox' );

		if ( false !== $cached ) {
			return $cached;
		}

		$conditions = [ 't.workspace_id = %d' ];
		$values     = [ $workspace_id ];

		if ( ! empty( $args['department_id'] ) ) {
			$conditions[] = 'EXISTS (SELECT 1 FROM `' . $table_pivot . '` tdp WHERE tdp.relation_id = t.id AND tdp.relatable_type = \'department\' AND tdp.relatable_id = %d)';
			$values[]     = (int) $args['department_id'];
		}

		if ( ! empty( $args['search'] ) ) {
			$conditions[] = 't.name LIKE %s';
			$values[]     = '%' . $wpdb->esc_like( sanitize_text_field( $args['search'] ) ) . '%';
		}

		$where    = implode( ' AND ', $conditions );
		$values[] = (int) ( $args['per_page'] ?? 100 );
		$values[] = (int) ( $args['offset'] ?? 0 );

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$query = "SELECT t.*,
					GROUP_CONCAT(d.id    ORDER BY d.name SEPARATOR '|') as dept_ids,
					GROUP_CONCAT(d.name  ORDER BY d.name SEPARATOR '|') as dept_names,
					GROUP_CONCAT(d.color ORDER BY d.name SEPARATOR '|') as dept_colors,
					(SELECT COUNT(*) FROM `{$table_members}` WHERE team_id = t.id) as members_count,
					(SELECT COUNT(*) FROM `{$table_pivot}` WHERE relation_id = t.id AND relatable_type = 'project') as projects_count
				FROM `{$table_teams}` t
				LEFT JOIN `{$table_pivot}` tdp ON tdp.relation_id = t.id AND tdp.relatable_type = 'department'
				LEFT JOIN `{$table_depts}` d ON d.id = tdp.relatable_id
				WHERE {$where}
				GROUP BY t.id
				ORDER BY t.position ASC, t.name ASC
				LIMIT %d OFFSET %d";

		// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			$wpdb->prepare( $query, ...$values ), // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			ARRAY_A
		);

		$result = array_map( [ self::class, 'format' ], $rows ?? [] );
		wp_cache_set( $cache_key, $result, 'softtent-todox' );

		return $result;
	}

	public static function get( int $id ): ?array {
		self::ensure_pivot_table();

		global $wpdb;

		$cache_key = 'team_' . $id;
		$cached    = wp_cache_get( $cache_key, 'softtent-todox' );

		if ( false !== $cached ) {
			return $cached ? $cached : null;
		}

		$table_teams = $wpdb->prefix . self::$table;
		$table_pivot = $wpdb->prefix . self::$pivot;
		$table_depts = $wpdb->prefix . 'st_todox_departments';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT t.*,
					GROUP_CONCAT(d.id    ORDER BY d.name SEPARATOR '|') as dept_ids,
					GROUP_CONCAT(d.name  ORDER BY d.name SEPARATOR '|') as dept_names,
					GROUP_CONCAT(d.color ORDER BY d.name SEPARATOR '|') as dept_colors
				FROM %i t
				LEFT JOIN %i tdp ON tdp.relation_id = t.id AND tdp.relatable_type = 'department'
				LEFT JOIN %i d ON d.id = tdp.relatable_id
				WHERE t.id = %d
				GROUP BY t.id",
				$table_teams,
				$table_pivot,
				$table_depts,
				$id
			),
			ARRAY_A
		);

		$result = $row ? self::format( $row ) : null;
		wp_cache_set( $cache_key, $result ? $result : false, 'softtent-todox' );

		return $result;
	}

	public static function create( array $data ): int|false {
		self::ensure_pivot_table();

		global $wpdb;

		$inserted = $wpdb->insert( // phpcs:ignore
			$wpdb->prefix . self::$table,
			[
				'workspace_id'  => (int) $data['workspace_id'],
				'name'          => sanitize_text_field( $data['name'] ),
				'description'   => isset( $data['description'] ) ? sanitize_textarea_field( $data['description'] ) : null,
				'color'         => Fns::sanitize_color( $data['color'] ?? '#6366f1' ),
				'avatar'        => isset( $data['avatar'] ) ? esc_url_raw( $data['avatar'] ) : null,
				'manager_id'    => isset( $data['manager_id'] ) ? (int) $data['manager_id'] : null,
			]
		);

		if ( ! $inserted ) {
			return false;
		}

		$team_id = (int) $wpdb->insert_id;

		$department_ids = self::parse_ids( $data['department_ids'] ?? $data['department_id'] ?? [] );
		self::sync_departments( $team_id, $department_ids );

		return $team_id;
	}

	public static function update( int $id, array $data ): bool {
		global $wpdb;

		$update = [];

		if ( isset( $data['name'] ) ) {
			$update['name'] = sanitize_text_field( $data['name'] );
		}
		if ( isset( $data['description'] ) ) {
			$update['description'] = sanitize_textarea_field( $data['description'] );
		}
		if ( isset( $data['color'] ) ) {
			$update['color'] = Fns::sanitize_color( $data['color'] );
		}
		if ( array_key_exists( 'manager_id', $data ) ) {
			$update['manager_id'] = $data['manager_id'] ? (int) $data['manager_id'] : null;
		}

		$updated = true;
		if ( ! empty( $update ) ) {
			$updated = (bool) $wpdb->update( $wpdb->prefix . self::$table, $update, [ 'id' => $id ] ); // phpcs:ignore
		}

		// Sync departments if provided (accept both department_ids array and legacy department_id scalar).
		if ( isset( $data['department_ids'] ) || isset( $data['department_id'] ) ) {
			$department_ids = self::parse_ids( $data['department_ids'] ?? $data['department_id'] );
			self::sync_departments( $id, $department_ids );
		}

		return $updated;
	}

	public static function delete( int $id ): bool {
		global $wpdb;

		// Remove all relation rows for this team (departments + projects + any future types).
		$wpdb->delete( $wpdb->prefix . self::$pivot, [ 'relation_id' => $id ] ); // phpcs:ignore

		return (bool) $wpdb->delete( $wpdb->prefix . self::$table, [ 'id' => $id ] ); // phpcs:ignore
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

	public static function sync_departments( int $team_id, array $department_ids ): void {
		self::ensure_pivot_table();

		global $wpdb;

		$table = $wpdb->prefix . self::$pivot;

		// Delete only the department associations for this team.
		$wpdb->delete( $table, [ 'relation_id' => $team_id, 'relatable_type' => 'department' ] ); // phpcs:ignore

		foreach ( array_unique( array_filter( $department_ids ) ) as $dept_id ) {
			$wpdb->insert( // phpcs:ignore
				$table,
				[
					'relation_id'    => $team_id,
					'relatable_id'   => (int) $dept_id,
					'relatable_type' => 'department',
				]
			);
		}
	}

	public static function get_members( int $team_id ): array {
		global $wpdb;

		$cache_key = 'team_members_' . $team_id;
		$cached    = wp_cache_get( $cache_key, 'softtent-todox' );

		if ( false !== $cached ) {
			return $cached;
		}

		$table_members = $wpdb->prefix . self::$members_table;
		$users_table   = $wpdb->users;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT tm.*, u.display_name as name, u.user_email as email
				FROM %i tm
				INNER JOIN %i u ON u.ID = tm.user_id
				WHERE tm.team_id = %d
				ORDER BY tm.joined_at ASC',
				$table_members,
				$users_table,
				$team_id
			),
			ARRAY_A
		);

		$result = array_map(
			fn( $r ) => [
				'id'        => (int) $r['user_id'],
				'name'      => $r['name'],
				'email'     => $r['email'],
				'avatar'    => get_avatar_url( (int) $r['user_id'], [ 'size' => 40 ] ),
				'team_role' => $r['team_role'],
				'joined_at' => Fns::format_datetime( $r['joined_at'] ),
			], $rows ?? []
		);

		wp_cache_set( $cache_key, $result, 'softtent-todox' );

		return $result;
	}

	public static function add_member( int $team_id, int $user_id, string $role = 'member' ): bool {
		global $wpdb;

		return (bool) $wpdb->replace( // phpcs:ignore
			$wpdb->prefix . self::$members_table,
			[
				'team_id'   => $team_id,
				'user_id'   => $user_id,
				'team_role' => in_array( $role, [ 'lead', 'member' ], true ) ? $role : 'member',
			]
		);
	}

	public static function remove_member( int $team_id, int $user_id ): bool {
		global $wpdb;

		return (bool) $wpdb->delete( $wpdb->prefix . self::$members_table, [ 'team_id' => $team_id, 'user_id' => $user_id ] ); // phpcs:ignore
	}

	public static function format( array $row ): array {
		$dept_ids    = ! empty( $row['dept_ids'] ) ? explode( '|', $row['dept_ids'] ) : [];
		$dept_names  = ! empty( $row['dept_names'] ) ? explode( '|', $row['dept_names'] ) : [];
		$dept_colors = ! empty( $row['dept_colors'] ) ? explode( '|', $row['dept_colors'] ) : [];

		$departments = [];
		foreach ( $dept_ids as $i => $did ) {
			$departments[] = [
				'id'    => (int) $did,
				'name'  => $dept_names[ $i ] ?? '',
				'color' => $dept_colors[ $i ] ?? '#6366f1',
			];
		}

		return [
			'id'             => (int) $row['id'],
			'workspace_id'   => (int) $row['workspace_id'],
			'name'           => $row['name'],
			'description'    => $row['description'],
			'color'          => $row['color'],
			'avatar'         => $row['avatar'],
			'manager_id'     => $row['manager_id'] ? (int) $row['manager_id'] : null,
			'manager'        => $row['manager_id'] ? Fns::get_user_info( (int) $row['manager_id'] ) : null,
			'department_ids' => array_map( 'intval', $dept_ids ),
			'departments'    => $departments,
			'members_count'  => (int) ( $row['members_count'] ?? 0 ),
			'projects_count' => (int) ( $row['projects_count'] ?? 0 ),
			'created_at'     => Fns::format_datetime( $row['created_at'] ),
			'updated_at'     => Fns::format_datetime( $row['updated_at'] ),
		];
	}

	/**
	 * Normalize department input: accepts an int, a string, or an array.
	 */
	private static function parse_ids( mixed $value ): array {
		if ( is_array( $value ) ) {
			return array_map( 'intval', $value );
		}

		if ( is_numeric( $value ) && (int) $value > 0 ) {
			return [ (int) $value ];
		}

		return [];
	}
}
