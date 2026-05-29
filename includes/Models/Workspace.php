<?php

namespace SoftTent\TodoX\Models;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Helpers\Fns;
use SoftTent\TodoX\Setup\Seeder;

/**
 * Workspace model — wraps all wpdb queries for workspaces.
 *
 * Direct database queries are used throughout this class because:
 * 1. These are custom tables not managed by WordPress core
 * 2. No alternative WordPress API exists for querying custom table data
 * 3. All queries use $wpdb->prepare() with proper placeholders for security
 *
 * @since 0.1.0
 */
class Workspace {

	private static string $table        = 'st_todox_workspaces';
	private static string $members_table = 'st_todox_workspace_members';

	/**
	 * Get all workspaces the current user belongs to.
	 *
	 * @since 0.1.0
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function get_all( int $user_id, array $args = [] ): array {
		global $wpdb;

		$table_workspaces = $wpdb->prefix . self::$table;
		$table_members    = $wpdb->prefix . self::$members_table;
		$table_depts      = $wpdb->prefix . 'st_todox_departments';
		$values           = [ $user_id ];
		$search_clause    = '';

		if ( ! empty( $args['search'] ) ) {
			$search_clause = ' AND w.name LIKE %s';
			$values[]      = '%' . $wpdb->esc_like( sanitize_text_field( $args['search'] ) ) . '%';
		}

		// Build query with escaped table identifiers.
		$query = "SELECT w.*, wm.role as member_role,
					(SELECT COUNT(*) FROM `{$table_members}` WHERE workspace_id = w.id) as members_count,
					(SELECT COUNT(*) FROM `{$table_depts}` WHERE workspace_id = w.id) as departments_count
				FROM `{$table_workspaces}` w
				INNER JOIN `{$table_members}` wm ON wm.workspace_id = w.id AND wm.user_id = %d
				WHERE 1=1{$search_clause}
				ORDER BY w.created_at DESC"; // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

		// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			$wpdb->prepare( $query, ...$values ), // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			ARRAY_A
		);

		$workspaces = array_map( [ self::class, 'format' ], $rows ?? [] );

		if ( ! empty( $workspaces ) ) {
			$ids         = array_column( $workspaces, 'id' );
			$members_map = self::get_members_for_workspaces( $ids );
			foreach ( $workspaces as &$ws ) {
				$ws['members'] = $members_map[ $ws['id'] ] ?? [];
			}
			unset( $ws );
		}

		return $workspaces;
	}

	/**
	 * Get a single workspace by ID.
	 *
	 * @since 0.1.0
	 *
	 * @return array<string, mixed>|null
	 */
	public static function get( int $id ): ?array {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM %i WHERE id = %d',
				$wpdb->prefix . self::$table,
				$id
			),
			ARRAY_A
		);

		return $row ? self::format( $row ) : null;
	}

	/**
	 * Get workspace by slug.
	 *
	 * @since 0.1.0
	 */
	public static function get_by_slug( string $slug ): ?array {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM %i WHERE slug = %s',
				$wpdb->prefix . self::$table,
				$slug
			),
			ARRAY_A
		);

		return $row ? self::format( $row ) : null;
	}

	/**
	 * Create a new workspace.
	 *
	 * @since 0.1.0
	 *
	 * @param array<string, mixed> $data
	 * @return int|false Inserted ID or false on failure.
	 */
	public static function create( array $data ): int|false {
		global $wpdb;

		$slug = Fns::generate_slug( $data['name'], self::$table );

		$inserted = $wpdb->insert( // phpcs:ignore
			$wpdb->prefix . self::$table,
			[
				'name'        => sanitize_text_field( $data['name'] ),
				'slug'        => $slug,
				'description' => isset( $data['description'] ) ? sanitize_textarea_field( $data['description'] ) : null,
				'logo'        => isset( $data['logo'] ) ? esc_url_raw( $data['logo'] ) : null,
				'color'       => Fns::sanitize_color( $data['color'] ?? '#6366f1' ),
				'owner_id'    => (int) $data['owner_id'],
				'is_public'   => isset( $data['is_public'] ) ? 1 : 0,
			]
		);

		if ( ! $inserted ) {
			return false;
		}

		$workspace_id = (int) $wpdb->insert_id;

		// Add owner as a member.
		self::add_member( $workspace_id, (int) $data['owner_id'], 'owner' );

		// Seed default taxonomies.
		Seeder::seed_workspace_defaults( $workspace_id );

		return $workspace_id;
	}

	/**
	 * Update a workspace.
	 *
	 * @since 0.1.0
	 *
	 * @param array<string, mixed> $data
	 */
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
		if ( isset( $data['logo'] ) ) {
			$update['logo'] = esc_url_raw( $data['logo'] );
		}
		if ( isset( $data['is_public'] ) ) {
			$update['is_public'] = (int) $data['is_public'];
		}

		if ( empty( $update ) ) {
			return false;
		}

		return (bool) $wpdb->update( // phpcs:ignore
			$wpdb->prefix . self::$table,
			$update,
			[ 'id' => $id ]
		);
	}

	/**
	 * Delete a workspace.
	 *
	 * @since 0.1.0
	 */
	public static function delete( int $id ): bool {
		global $wpdb;

		return (bool) $wpdb->delete( // phpcs:ignore
			$wpdb->prefix . self::$table,
			[ 'id' => $id ]
		);
	}

	/**
	 * Add a user as a workspace member.
	 *
	 * @since 0.1.0
	 */
	public static function add_member( int $workspace_id, int $user_id, string $role = 'member' ): bool {
		global $wpdb;

		return (bool) $wpdb->replace( // phpcs:ignore
			$wpdb->prefix . self::$members_table,
			[
				'workspace_id' => $workspace_id,
				'user_id'      => $user_id,
				'role'         => in_array( $role, [ 'owner', 'admin', 'member', 'guest' ], true ) ? $role : 'member',
			]
		);
	}

	/**
	 * Remove a user from a workspace.
	 *
	 * @since 0.1.0
	 */
	public static function remove_member( int $workspace_id, int $user_id ): bool {
		global $wpdb;

		return (bool) $wpdb->delete( // phpcs:ignore
			$wpdb->prefix . self::$members_table,
			[
				'workspace_id' => $workspace_id,
				'user_id'      => $user_id,
			]
		);
	}

	/**
	 * Get all members of a workspace.
	 *
	 * @since 0.1.0
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function get_members( int $workspace_id ): array {
		global $wpdb;

		$table_members = $wpdb->prefix . self::$members_table;
		$users_table   = $wpdb->users;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT wm.*, u.display_name as name, u.user_email as email
				FROM %i wm
				INNER JOIN %i u ON u.ID = wm.user_id
				WHERE wm.workspace_id = %d
				ORDER BY wm.joined_at ASC',
				$table_members,
				$users_table,
				$workspace_id
			),
			ARRAY_A
		);

		return array_map(
            function ( $row ) {
                return [
					'id'        => (int) $row['user_id'],
					'name'      => $row['name'],
					'email'     => $row['email'],
					'avatar'    => get_avatar_url( (int) $row['user_id'], [ 'size' => 40 ] ),
					'role'      => $row['role'],
					'joined_at' => Fns::format_datetime( $row['joined_at'] ),
                ];
            }, $rows ?? []
        );
	}

	/**
	 * Batch-load members for multiple workspaces in one query.
	 *
	 * @since 0.1.0
	 *
	 * @param int[] $workspace_ids
	 * @return array<int, array[]>
	 */
	private static function get_members_for_workspaces( array $workspace_ids ): array {
		global $wpdb;

		$ids = array_values( array_unique( array_filter( array_map( 'intval', $workspace_ids ) ) ) );
		if ( empty( $ids ) ) {
			return [];
		}

		$table_members = $wpdb->prefix . self::$members_table;
		$users_table   = $wpdb->users;
		$placeholders  = implode( ',', array_fill( 0, count( $ids ), '%d' ) );

		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$query = "SELECT wm.workspace_id, wm.user_id, wm.role, wm.joined_at, u.display_name as name, u.user_email as email FROM `{$table_members}` wm INNER JOIN `{$users_table}` u ON u.ID = wm.user_id WHERE wm.workspace_id IN ({$placeholders}) ORDER BY wm.joined_at ASC";

		$rows = $wpdb->get_results(
			$wpdb->prepare( $query, ...$ids ),
			ARRAY_A
		);
		// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		$map = [];
		foreach ( $rows ?? [] as $row ) {
			$wid         = (int) $row['workspace_id'];
			$map[ $wid ][] = [
				'id'        => (int) $row['user_id'],
				'name'      => $row['name'],
				'email'     => $row['email'],
				'avatar'    => get_avatar_url( (int) $row['user_id'], [ 'size' => 40 ] ),
				'role'      => $row['role'],
				'joined_at' => Fns::format_datetime( $row['joined_at'] ),
			];
		}

		return $map;
	}

	/**
	 * Whether the user is a member of at least one workspace.
	 *
	 * Used as a coarse "this person has any business calling the app at all"
	 * gate so subscribers/customers with no workspace membership cannot probe
	 * user-scoped endpoints (notifications, /users/me) just by being logged in.
	 *
	 * @since 0.2.0
	 */
	public static function has_any_membership( int $user_id ): bool {
		if ( $user_id <= 0 ) {
			return false;
		}

		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return (bool) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM %i WHERE user_id = %d LIMIT 1',
				$wpdb->prefix . self::$members_table,
				$user_id
			)
		);
	}

	/**
	 * Check if a user is a member of a workspace.
	 *
	 * @since 0.1.0
	 */
	public static function is_member( int $workspace_id, int $user_id ): bool {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return (bool) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM %i WHERE workspace_id = %d AND user_id = %d LIMIT 1',
				$wpdb->prefix . self::$members_table,
				$workspace_id,
				$user_id
			)
		);
	}

	/**
	 * Get member role in a workspace.
	 *
	 * @since 0.1.0
	 */
	public static function get_member_role( int $workspace_id, int $user_id ): ?string {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return $wpdb->get_var(
			$wpdb->prepare(
				'SELECT role FROM %i WHERE workspace_id = %d AND user_id = %d LIMIT 1',
				$wpdb->prefix . self::$members_table,
				$workspace_id,
				$user_id
			)
		);
	}

	/**
	 * Count members of a workspace.
	 *
	 * @since 0.1.0
	 */
	public static function count_members( int $workspace_id ): int {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM %i WHERE workspace_id = %d',
				$wpdb->prefix . self::$members_table,
				$workspace_id
			)
		);
	}

	/**
	 * Format a raw DB row for API output.
	 *
	 * @since 0.1.0
	 *
	 * @param array<string, mixed> $row
	 * @return array<string, mixed>
	 */
	public static function format( array $row ): array {
		return [
			'id'                 => (int) $row['id'],
			'name'               => $row['name'],
			'slug'               => $row['slug'],
			'description'        => $row['description'],
			'logo'               => $row['logo'],
			'color'              => $row['color'],
			'owner_id'           => (int) $row['owner_id'],
			'is_public'          => (bool) $row['is_public'],
			'member_role'        => $row['member_role'] ?? null,
			'members_count'      => (int) ( $row['members_count'] ?? 0 ),
			'departments_count'  => (int) ( $row['departments_count'] ?? 0 ),
			'created_at'         => Fns::format_datetime( $row['created_at'] ),
			'updated_at'         => Fns::format_datetime( $row['updated_at'] ),
		];
	}
}
