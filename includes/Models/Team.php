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
	private static string $members_table = 'st_todox_team_members';

	public static function get_all( int $workspace_id, array $args = [] ): array {
		global $wpdb;

		$table_teams   = $wpdb->prefix . self::$table;
		$table_members = $wpdb->prefix . self::$members_table;
		$table_projs   = $wpdb->prefix . 'st_todox_projects';
		$table_depts   = $wpdb->prefix . 'st_todox_departments';

		$cache_key = 'teams_' . $workspace_id . '_' . md5( wp_json_encode( $args ) );
		$cached    = wp_cache_get( $cache_key, 'softtent-todox' );

		if ( false !== $cached ) {
			return $cached;
		}

		$conditions = [ 't.workspace_id = %d' ];
		$values     = [ $workspace_id ];

		if ( ! empty( $args['department_id'] ) ) {
			$conditions[] = 't.department_id = %d';
			$values[]     = (int) $args['department_id'];
		}

		if ( ! empty( $args['search'] ) ) {
			$conditions[] = 't.name LIKE %s';
			$values[]     = '%' . $wpdb->esc_like( sanitize_text_field( $args['search'] ) ) . '%';
		}

		$where    = implode( ' AND ', $conditions );
		$values[] = (int) ( $args['per_page'] ?? 100 );
		$values[] = (int) ( $args['offset'] ?? 0 );

		// Build query with escaped table identifiers.
		$query = "SELECT t.*, d.name as department_name, d.color as department_color,
					(SELECT COUNT(*) FROM `{$table_members}` WHERE team_id = t.id) as members_count,
					(SELECT COUNT(*) FROM `{$table_projs}` WHERE team_id = t.id) as projects_count
				FROM `{$table_teams}` t
				LEFT JOIN `{$table_depts}` d ON d.id = t.department_id
				WHERE {$where}
				ORDER BY t.name ASC
				LIMIT %d OFFSET %d"; // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

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
		global $wpdb;

		$cache_key = 'team_' . $id;
		$cached    = wp_cache_get( $cache_key, 'softtent-todox' );

		if ( false !== $cached ) {
			return $cached ? $cached : null;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT t.*, d.name as department_name, d.color as department_color
				FROM %i t
				LEFT JOIN %i d ON d.id = t.department_id
				WHERE t.id = %d',
				$wpdb->prefix . self::$table,
				$wpdb->prefix . 'st_todox_departments',
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

		$inserted = $wpdb->insert( // phpcs:ignore
			$wpdb->prefix . self::$table,
			[
				'department_id' => (int) $data['department_id'],
				'workspace_id'  => (int) $data['workspace_id'],
				'name'          => sanitize_text_field( $data['name'] ),
				'description'   => isset( $data['description'] ) ? sanitize_textarea_field( $data['description'] ) : null,
				'color'         => Fns::sanitize_color( $data['color'] ?? '#6366f1' ),
				'avatar'        => isset( $data['avatar'] ) ? esc_url_raw( $data['avatar'] ) : null,
				'manager_id'    => isset( $data['manager_id'] ) ? (int) $data['manager_id'] : null,
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
			$update['description'] = sanitize_textarea_field( $data['description'] );
        }
		if ( isset( $data['color'] ) ) {
			$update['color'] = Fns::sanitize_color( $data['color'] );
        }
		if ( isset( $data['department_id'] ) ) {
			$update['department_id'] = (int) $data['department_id'];
        }
		if ( array_key_exists( 'manager_id', $data ) ) {
			$update['manager_id'] = $data['manager_id'] ? (int) $data['manager_id'] : null;
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
		return [
			'id'              => (int) $row['id'],
			'department_id'   => (int) $row['department_id'],
			'workspace_id'    => (int) $row['workspace_id'],
			'name'            => $row['name'],
			'description'     => $row['description'],
			'color'           => $row['color'],
			'avatar'          => $row['avatar'],
			'manager_id'      => $row['manager_id'] ? (int) $row['manager_id'] : null,
			'manager'         => $row['manager_id'] ? Fns::get_user_info( (int) $row['manager_id'] ) : null,
			'department'      => [
				'id'    => (int) $row['department_id'],
				'name'  => $row['department_name'] ?? '',
				'color' => $row['department_color'] ?? '#6366f1',
			],
			'members_count'   => (int) ( $row['members_count'] ?? 0 ),
			'projects_count'  => (int) ( $row['projects_count'] ?? 0 ),
			'created_at'      => Fns::format_datetime( $row['created_at'] ),
			'updated_at'      => Fns::format_datetime( $row['updated_at'] ),
		];
	}
}
