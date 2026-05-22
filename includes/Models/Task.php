<?php

namespace SoftTent\TodoX\Models;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Helpers\Fns;

/**
 * Task model — query layer for tasks and related data.
 *
 * Direct database queries are used throughout this class because:
 * 1. These are custom tables not managed by WordPress core
 * 2. No alternative WordPress API exists for querying custom table data
 * 3. All queries use $wpdb->prepare() with proper placeholders for security
 *
 * @since 0.1.0
 */
class Task {

	private static string $table       = 'st_todox_tasks';
	private static string $labels_table = 'st_todox_task_labels';

	/**
	 * Get tasks with filters and pagination.
	 *
	 * @since 0.1.0
	 *
	 * @param array<string, mixed> $args
	 * @return array{items: array, total: int}
	 */
	public static function get_all( array $args = [] ): array {
		global $wpdb;

		$tt = $wpdb->prefix . self::$table;

		$conditions = [ '1=1', 't.is_archived = 0' ];
		$values     = [];

		if ( ! empty( $args['workspace_id'] ) ) {
			$conditions[] = 't.workspace_id = %d';
			$values[]     = (int) $args['workspace_id'];
		}

		if ( ! empty( $args['project_id'] ) ) {
			$conditions[] = 't.project_id = %d';
			$values[]     = (int) $args['project_id'];
		}

		if ( ! empty( $args['sprint_id'] ) ) {
			$conditions[] = 't.sprint_id = %d';
			$values[]     = (int) $args['sprint_id'];
		}

		if ( ! empty( $args['status'] ) ) {
			$statuses = (array) $args['status'];
			$placeholders = implode( ',', array_fill( 0, count( $statuses ), '%s' ) );
			$conditions[] = "t.status IN ({$placeholders})";
			$values = array_merge( $values, $statuses );
		}

		if ( ! empty( $args['priority'] ) ) {
			$priorities = (array) $args['priority'];
			$placeholders = implode( ',', array_fill( 0, count( $priorities ), '%s' ) );
			$conditions[] = "t.priority IN ({$placeholders})";
			$values = array_merge( $values, $priorities );
		}

		if ( ! empty( $args['assignee_id'] ) ) {
			$conditions[] = 't.assignee_id = %d';
			$values[]     = (int) $args['assignee_id'];
		}

		if ( ! empty( $args['search'] ) ) {
			$conditions[] = 't.title LIKE %s';
			$values[]     = '%' . $wpdb->esc_like( sanitize_text_field( $args['search'] ) ) . '%';
		}

		$where    = implode( ' AND ', $conditions );
		$per_page = (int) ( $args['per_page'] ?? 50 );
		$offset   = (int) ( $args['offset'] ?? 0 );
		$order_by = in_array( $args['order_by'] ?? '', [ 'position', 'created_at', 'due_date', 'priority' ], true )
			? sanitize_sql_orderby( 't.' . $args['order_by'] )
			: 't.position';
		$order    = strtoupper( $args['order'] ?? 'ASC' ) === 'DESC' ? 'DESC' : 'ASC';

		// COUNT query — uses same WHERE clause without LIMIT/OFFSET.
		$count_query = "SELECT COUNT(*) FROM `{$tt}` t WHERE {$where}"; // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
		$total = (int) $wpdb->get_var( $wpdb->prepare( $count_query, ...$values ) );

		$values[] = $per_page;
		$values[] = $offset;

		// Build the main query with escaped table name.
		$main_query = "SELECT t.* FROM `{$tt}` t WHERE {$where} ORDER BY {$order_by} {$order} LIMIT %d OFFSET %d"; // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
		$rows = $wpdb->get_results( $wpdb->prepare( $main_query, ...$values ), ARRAY_A );

		$items = array_map( [ self::class, 'format' ], $rows ?? [] );

		return compact( 'items', 'total' );
	}

	/**
	 * Get a single task with full relations.
	 *
	 * @since 0.1.0
	 *
	 * @return array<string, mixed>|null
	 */
	public static function get( int $id ): ?array {
		global $wpdb;

		$table_name = $wpdb->prefix . self::$table;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM %i WHERE id = %d',
				$table_name,
				$id
			),
			ARRAY_A
		);

		if ( ! $row ) {
			return null;
		}

		$task = self::format( $row );

		// Attach labels.
		$task['labels'] = self::get_labels( $id );

		// Attach subtasks summary.
		$task['subtasks'] = Subtask::get_all( $id );

		// Attach comments.
		$task['comments'] = TaskComment::get_all( $id );

		// Attach activities.
		$task['activities'] = TaskActivity::get_all( $id );

		return $task;
	}

	/**
	 * Create a task.
	 *
	 * @since 0.1.0
	 *
	 * @param array<string, mixed> $data
	 * @return int|false
	 */
	public static function create( array $data ): int|false {
		global $wpdb;

		// Determine position (append to end of sprint/project).
		$position = self::get_next_position( $data );

		$inserted = $wpdb->insert( // phpcs:ignore
			$wpdb->prefix . self::$table,
			[
				'sprint_id'    => isset( $data['sprint_id'] ) ? (int) $data['sprint_id'] : null,
				'project_id'   => isset( $data['project_id'] ) ? (int) $data['project_id'] : null,
				'workspace_id' => isset( $data['workspace_id'] ) ? (int) $data['workspace_id'] : null,
				'title'        => sanitize_text_field( $data['title'] ),
				'description'  => isset( $data['description'] ) ? wp_kses_post( $data['description'] ) : null,
				'status'       => self::valid_status( $data['status'] ?? 'todo' ),
				'priority'     => self::valid_priority( $data['priority'] ?? 'medium' ),
				'due_date'     => $data['due_date'] ?? null,
				'position'     => $position,
				'assignee_id'  => isset( $data['assignee_id'] ) ? (int) $data['assignee_id'] : null,
				'creator_id'   => (int) $data['creator_id'],
				'taxonomy_id'  => isset( $data['taxonomy_id'] ) ? (int) $data['taxonomy_id'] : null,
			]
		);

		if ( ! $inserted ) {
			return false;
		}

		$task_id = (int) $wpdb->insert_id;

		// Insert labels.
		if ( ! empty( $data['labels'] ) && is_array( $data['labels'] ) ) {
			self::sync_labels( $task_id, $data['labels'] );
		}

		// Log activity.
		TaskActivity::log( $task_id, (int) $data['creator_id'], 'created', null );

		return $task_id;
	}

	/**
	 * Update a task.
	 *
	 * @since 0.1.0
	 *
	 * @param array<string, mixed> $data
	 */
	public static function update( int $id, array $data, int $user_id = 0 ): bool {
		global $wpdb;

		$allowed = [ 'title', 'description', 'status', 'priority', 'due_date', 'assignee_id', 'sprint_id', 'position', 'taxonomy_id', 'is_archived' ];
		$update  = [];

		foreach ( $allowed as $field ) {
			if ( ! array_key_exists( $field, $data ) ) {
				continue;
			}

			switch ( $field ) {
				case 'title':
					$update['title'] = sanitize_text_field( $data['title'] );
					break;
				case 'description':
					$update['description'] = wp_kses_post( $data['description'] );
					break;
				case 'status':
					$update['status'] = self::valid_status( $data['status'] );
					break;
				case 'priority':
					$update['priority'] = self::valid_priority( $data['priority'] );
					break;
				case 'assignee_id':
				case 'sprint_id':
				case 'position':
				case 'taxonomy_id':
					$update[ $field ] = $data[ $field ] !== null ? (int) $data[ $field ] : null;
					break;
				case 'due_date':
					$update['due_date'] = ! empty( $data['due_date'] ) ? $data['due_date'] : null;
					break;
				case 'is_archived':
					$update['is_archived'] = (int) $data['is_archived'];
					break;
			}
		}

		if ( empty( $update ) ) {
			return false;
		}

		$result = (bool) $wpdb->update( // phpcs:ignore
			$wpdb->prefix . self::$table,
			$update,
			[ 'id' => $id ]
		);

		// Sync labels if provided.
		if ( isset( $data['labels'] ) && is_array( $data['labels'] ) ) {
			self::sync_labels( $id, $data['labels'] );
		}

		// Log status change.
		if ( isset( $update['status'] ) && $user_id ) {
			TaskActivity::log( $id, $user_id, 'status_changed', $update['status'] );
		}

		return $result;
	}

	/**
	 * Delete a task.
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
	 * Bulk reorder tasks (for Kanban drag-and-drop).
	 *
	 * @since 0.1.0
	 *
	 * @param array<int, array{id: int, position: int, status: string}> $items
	 */
	public static function reorder( array $items ): bool {
		global $wpdb;

		foreach ( $items as $item ) {
			$wpdb->update( // phpcs:ignore
				$wpdb->prefix . self::$table,
				[
					'position' => (int) $item['position'],
					'status'   => self::valid_status( $item['status'] ?? 'todo' ),
				],
				[ 'id' => (int) $item['id'] ]
			);
		}

		return true;
	}

	/**
	 * Get task stats for a workspace.
	 *
	 * @since 0.1.0
	 *
	 * @return array<string, int>
	 */
	public static function get_stats( int $workspace_id ): array {
		global $wpdb;

		$tt = $wpdb->prefix . self::$table;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT status, COUNT(*) as count FROM %i WHERE workspace_id = %d AND is_archived = 0 GROUP BY status',
				$tt,
				$workspace_id
			),
			ARRAY_A
		);

		$stats = [
			'total' => 0,
			'todo' => 0,
			'in_progress' => 0,
			'review' => 0,
			'completed' => 0,
			'overdue' => 0,
		];

		foreach ( $rows as $row ) {
			$key = $row['status'];
			if ( isset( $stats[ $key ] ) ) {
				$stats[ $key ] = (int) $row['count'];
			}
			$stats['total'] += (int) $row['count'];
		}

		// Overdue.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$stats['overdue'] = (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM %i WHERE workspace_id = %d AND is_archived = 0 AND status != %s AND due_date < CURDATE()',
				$tt,
				$workspace_id,
				'completed'
			)
		);

		return $stats;
	}

	/**
	 * Get labels for a task.
	 *
	 * @since 0.1.0
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function get_labels( int $task_id ): array {
		global $wpdb;

		$labels_table = $wpdb->prefix . self::$labels_table;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM %i WHERE task_id = %d',
				$labels_table,
				$task_id
			),
			ARRAY_A
		);

		return array_map(
            fn( $r ) => [
				'id'    => (int) $r['id'],
				'name'  => $r['name'],
				'color' => $r['color'],
            ], $rows ?? []
        );
	}

	/**
	 * Sync labels for a task (delete and re-insert).
	 *
	 * @since 0.1.0
	 *
	 * @param array<int, array{name: string, color: string}> $labels
	 */
	public static function sync_labels( int $task_id, array $labels ): void {
		global $wpdb;

		$wpdb->delete( $wpdb->prefix . self::$labels_table, [ 'task_id' => $task_id ] ); // phpcs:ignore

		foreach ( $labels as $label ) {
			$wpdb->insert( // phpcs:ignore
				$wpdb->prefix . self::$labels_table,
				[
					'task_id' => $task_id,
					'name'    => sanitize_text_field( $label['name'] ),
					'color'   => Fns::sanitize_color( $label['color'] ?? '#6366f1' ),
				]
			);
		}
	}

	/**
	 * Get next position for a task in its container.
	 *
	 * @since 0.1.0
	 */
	private static function get_next_position( array $data ): int {
		global $wpdb;

		$tt = $wpdb->prefix . self::$table;

		if ( ! empty( $data['sprint_id'] ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			return 1 + (int) $wpdb->get_var(
				$wpdb->prepare(
					'SELECT MAX(position) FROM %i WHERE sprint_id = %d',
					$tt,
					(int) $data['sprint_id']
				)
			);
		}

		if ( ! empty( $data['project_id'] ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			return 1 + (int) $wpdb->get_var(
				$wpdb->prepare(
					'SELECT MAX(position) FROM %i WHERE project_id = %d',
					$tt,
					(int) $data['project_id']
				)
			);
		}

		return 0;
	}

	private static function valid_status( string $status ): string {
		$slug = strtolower( trim( preg_replace( '/[^a-z0-9_]+/i', '_', $status ) ) );
		return $slug !== '' ? $slug : 'todo';
	}

	private static function valid_priority( string $priority ): string {
		return in_array( $priority, [ 'low', 'medium', 'high', 'urgent' ], true ) ? $priority : 'medium';
	}

	/**
	 * Format a raw DB row.
	 *
	 * @since 0.1.0
	 *
	 * @param array<string, mixed> $row
	 * @return array<string, mixed>
	 */
	public static function format( array $row ): array {
		return [
			'id'           => (int) $row['id'],
			'sprint_id'    => $row['sprint_id'] ? (int) $row['sprint_id'] : null,
			'project_id'   => $row['project_id'] ? (int) $row['project_id'] : null,
			'workspace_id' => $row['workspace_id'] ? (int) $row['workspace_id'] : null,
			'title'        => $row['title'],
			'description'  => $row['description'],
			'status'       => $row['status'],
			'taxonomy_id'  => $row['taxonomy_id'] ? (int) $row['taxonomy_id'] : null,
			'priority'     => $row['priority'],
			'due_date'     => $row['due_date'],
			'position'     => (int) $row['position'],
			'is_archived'  => (bool) $row['is_archived'],
			'assignee_id'  => $row['assignee_id'] ? (int) $row['assignee_id'] : null,
			'assignee'     => $row['assignee_id'] ? Fns::get_user_info( (int) $row['assignee_id'] ) : null,
			'creator_id'   => (int) $row['creator_id'],
			'creator'      => Fns::get_user_info( (int) $row['creator_id'] ),
			'labels'       => [],
			'created_at'   => Fns::format_datetime( $row['created_at'] ),
			'updated_at'   => Fns::format_datetime( $row['updated_at'] ),
		];
	}
}
