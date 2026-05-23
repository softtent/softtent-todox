<?php

namespace SoftTent\TodoX\Models;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Helpers\Fns;

/**
 * Taxonomy model — flexible status/category system.
 *
 * Direct database queries are used throughout this class because:
 * 1. These are custom tables not managed by WordPress core
 * 2. No alternative WordPress API exists for querying custom table data
 * 3. All queries use $wpdb->prepare() with proper placeholders for security
 *
 * @since 0.1.0
 */
class Taxonomy {

	private static string $table = 'st_todox_taxonomies';

	public static function get_all( int $workspace_id, ?string $type = null ): array {
		global $wpdb;

		$cache_key = 'taxonomies_' . $workspace_id . '_' . ( $type ?? 'all' );
		$cached    = wp_cache_get( $cache_key, 'softtent-todox' );

		if ( false !== $cached ) {
			return $cached;
		}

		$table = $wpdb->prefix . self::$table;

		if ( $type ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT * FROM %i WHERE (workspace_id = %d OR workspace_id IS NULL) AND type = %s ORDER BY workspace_id DESC, position ASC',
					$table,
					$workspace_id,
					$type
				),
				ARRAY_A
			);
		} else {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT * FROM %i WHERE workspace_id = %d OR workspace_id IS NULL ORDER BY type ASC, workspace_id DESC, position ASC',
					$table,
					$workspace_id
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

		$cache_key = 'taxonomy_' . $id;
		$cached    = wp_cache_get( $cache_key, 'softtent-todox' );

		if ( false !== $cached ) {
			return $cached ? $cached : null;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
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

	public static function create( array $data ): int|false {
		global $wpdb;

		$is_global    = ! empty( $data['is_global'] );
		$workspace_id = $is_global ? null : (int) $data['workspace_id'];

		// No caching for position query - must get current value for accurate ordering.
		if ( ! $is_global ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$position = 1 + (int) $wpdb->get_var(
				$wpdb->prepare(
					'SELECT MAX(position) FROM %i WHERE workspace_id = %d AND type = %s',
					$wpdb->prefix . self::$table,
					$workspace_id,
					sanitize_text_field( $data['type'] )
				)
			);
		} else {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$position = 1 + (int) $wpdb->get_var(
				$wpdb->prepare(
					'SELECT MAX(position) FROM %i WHERE workspace_id IS NULL AND type = %s',
					$wpdb->prefix . self::$table,
					sanitize_text_field( $data['type'] )
				)
			);
		}

		$name     = sanitize_text_field( $data['name'] );
		$slug = isset( $data['slug'] ) && $data['slug'] !== ''
			? sanitize_text_field( $data['slug'] )
			: self::slugify( $name );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		$inserted = $wpdb->insert(
			$wpdb->prefix . self::$table,
			[
				'workspace_id' => $workspace_id,
				'name'         => $name,
				'type'         => sanitize_text_field( $data['type'] ),
				'slug'         => $slug,
				'color'        => Fns::sanitize_color( $data['color'] ?? '#6366f1' ),
				'icon'         => isset( $data['icon'] ) ? sanitize_text_field( $data['icon'] ) : null,
				'position'     => $position,
				'is_active'    => 1,
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
		if ( isset( $data['color'] ) ) {
			$update['color'] = Fns::sanitize_color( $data['color'] );
		}
		if ( isset( $data['icon'] ) ) {
			$update['icon'] = sanitize_text_field( $data['icon'] );
		}
		if ( isset( $data['position'] ) ) {
			$update['position'] = (int) $data['position'];
		}
		if ( isset( $data['is_active'] ) ) {
			$update['is_active'] = (int) $data['is_active'];
		}
		if ( array_key_exists( 'is_global', $data ) ) {
			$update['workspace_id'] = $data['is_global'] ? null : (int) $data['workspace_id'];
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

	public static function reorder( array $items ): void {
		global $wpdb;

		$table = $wpdb->prefix . self::$table;

		foreach ( $items as $item ) {
			$id       = isset( $item['id'] ) ? (int) $item['id'] : 0;
			$position = isset( $item['position'] ) ? (int) $item['position'] : 0;
			if ( $id ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
				$wpdb->update( $table, [ 'position' => $position ], [ 'id' => $id ] );
			}
		}

		wp_cache_flush_group( 'softtent-todox' );
	}

	public static function slugify( string $name ): string {
		$slug = strtolower( trim( $name ) );
		$slug = preg_replace( '/[^a-z0-9]+/', '_', $slug );
		return trim( $slug, '_' );
	}

	public static function format( array $row ): array {
		return [
			'id'           => (int) $row['id'],
			'workspace_id' => isset( $row['workspace_id'] ) && $row['workspace_id'] !== null ? (int) $row['workspace_id'] : null,
			'is_global'    => ! isset( $row['workspace_id'] ) || $row['workspace_id'] === null,
			'name'         => $row['name'],
			'type'         => $row['type'],
			'slug'         => $row['slug'],
			'color'        => $row['color'],
			'icon'         => $row['icon'],
			'position'     => (int) $row['position'],
			'is_active'    => (bool) $row['is_active'],
			'created_at'   => Fns::format_datetime( $row['created_at'] ),
			'updated_at'   => Fns::format_datetime( $row['updated_at'] ),
		];
	}
}
