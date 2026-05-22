<?php

namespace SoftTent\TodoX\Models;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Helpers\Fns;

/**
 * Department model.
 *
 * Direct database queries are used throughout this class because:
 * 1. These are custom tables not managed by WordPress core
 * 2. No alternative WordPress API exists for querying custom table data
 * 3. All queries use $wpdb->prepare() with proper placeholders for security
 *
 * @since 0.1.0
 */
class Department {

	private static string $table = 'st_todox_departments';

	public static function get_all( int $workspace_id, array $args = [] ): array {
		global $wpdb;

		$table_name    = $wpdb->prefix . self::$table;
		$teams_table   = $wpdb->prefix . 'st_todox_teams';
		$values        = [ $workspace_id ];
		$search_clause = '';

		if ( ! empty( $args['search'] ) ) {
			$search_clause = ' AND name LIKE %s';
			$values[]      = '%' . $wpdb->esc_like( sanitize_text_field( $args['search'] ) ) . '%';
		}

		// Build query with escaped table identifiers.
		$query = "SELECT d.*,
					(SELECT COUNT(*) FROM `{$teams_table}` WHERE department_id = d.id) as teams_count
				FROM `{$table_name}` d
				WHERE d.workspace_id = %d{$search_clause}
				ORDER BY d.name ASC"; // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

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
			$wpdb->prepare( 'SELECT * FROM %i WHERE id = %d', $wpdb->prefix . self::$table, $id ),
			ARRAY_A
		);

		return $row ? self::format( $row ) : null;
	}

	public static function create( array $data ): int|false {
		global $wpdb;

		$inserted = $wpdb->insert( // phpcs:ignore
			$wpdb->prefix . self::$table,
			[
				'workspace_id' => (int) $data['workspace_id'],
				'name'         => sanitize_text_field( $data['name'] ),
				'description'  => isset( $data['description'] ) ? sanitize_textarea_field( $data['description'] ) : null,
				'color'        => Fns::sanitize_color( $data['color'] ?? '#6366f1' ),
				'head_id'      => isset( $data['head_id'] ) ? (int) $data['head_id'] : null,
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
		if ( array_key_exists( 'head_id', $data ) ) {
			$update['head_id'] = $data['head_id'] ? (int) $data['head_id'] : null;
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
			'id'           => (int) $row['id'],
			'workspace_id' => (int) $row['workspace_id'],
			'name'         => $row['name'],
			'description'  => $row['description'],
			'color'        => $row['color'],
			'head_id'      => $row['head_id'] ? (int) $row['head_id'] : null,
			'head'         => $row['head_id'] ? Fns::get_user_info( (int) $row['head_id'] ) : null,
			'teams_count'  => (int) ( $row['teams_count'] ?? 0 ),
			'created_at'   => Fns::format_datetime( $row['created_at'] ),
			'updated_at'   => Fns::format_datetime( $row['updated_at'] ),
		];
	}
}
