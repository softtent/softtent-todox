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

	private static string $table = 'st_todox_tasks';

	/**
	 * Get tasks with filters and pagination.
	 *
	 * `workspace_id` is required to prevent cross-workspace data leaks.
	 *
	 * @since 0.1.0
	 *
	 * @param array<string, mixed> $args
	 * @return array{items: array, total: int}
	 */
	public static function get_all( array $args = [] ): array {
		global $wpdb;

		$tt = $wpdb->prefix . self::$table;

		$workspace_id = isset( $args['workspace_id'] ) ? (int) $args['workspace_id'] : 0;
		if ( $workspace_id <= 0 ) {
			return [
				'items' => [],
				'total' => 0,
			];
		}

		$conditions = [ 't.workspace_id = %d', 't.is_archived = 0' ];
		$values     = [ $workspace_id ];

		if ( ! empty( $args['project_id'] ) ) {
			$conditions[] = 't.project_id = %d';
			$values[]     = (int) $args['project_id'];
		}

		if ( ! empty( $args['sprint_id'] ) ) {
			$conditions[] = 't.sprint_id = %d';
			$values[]     = (int) $args['sprint_id'];
		}

		if ( ! empty( $args['status'] ) ) {
			$status_ids = [];
			foreach ( (array) $args['status'] as $slug ) {
				$sid = self::resolve_status_id( sanitize_key( $slug ), $workspace_id );
				if ( $sid ) {
					$status_ids[] = $sid;
				}
			}
			if ( ! empty( $status_ids ) ) {
				$placeholders = implode( ',', array_fill( 0, count( $status_ids ), '%d' ) );
				$conditions[] = "t.status_id IN ({$placeholders})";
				$values       = array_merge( $values, $status_ids );
			}
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
			? 't.' . $args['order_by']
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
	 * Get a single task.
	 *
	 * Relations are opt-in via the `$with` argument. Pass `true` to include
	 * everything, or an array of relation names to include a subset:
	 * `subtasks`, `comments`, `activities`.
	 *
	 * @since 0.1.0
	 *
	 * @param int             $id
	 * @param bool|array<int, string> $with Relations to eager-load.
	 * @return array<string, mixed>|null
	 */
	public static function get( int $id, bool|array $with = [] ): ?array {
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
		$task['labels'] = self::resolve_labels( $task['label_ids'] );

		$relations = $with === true
			? [ 'subtasks', 'comments', 'activities' ]
			: (array) $with;

		if ( in_array( 'subtasks', $relations, true ) ) {
			$task['subtasks'] = Subtask::get_all( $id );
		}

		if ( in_array( 'comments', $relations, true ) ) {
			$task['comments'] = TaskComment::get_all( $id );
		}

		if ( in_array( 'activities', $relations, true ) ) {
			$task['activities'] = TaskActivity::get_all( $id );
		}

		return $task;
	}

	/**
	 * Resolve the workspace ID for a task. Returns null if the task does not exist.
	 *
	 * @since 0.2.0
	 */
	public static function get_workspace_id( int $task_id ): ?int {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$value = $wpdb->get_var(
			$wpdb->prepare(
				'SELECT workspace_id FROM %i WHERE id = %d',
				$wpdb->prefix . self::$table,
				$task_id
			)
		);

		return $value === null ? null : (int) $value;
	}

	/**
	 * Resolve workspace IDs for many tasks at once. Returns task_id => workspace_id.
	 *
	 * @since 0.2.0
	 *
	 * @param array<int, int> $task_ids
	 * @return array<int, int>
	 */
	public static function get_workspace_ids( array $task_ids ): array {
		global $wpdb;

		$ids = array_values( array_unique( array_filter( array_map( 'intval', $task_ids ) ) ) );
		if ( empty( $ids ) ) {
			return [];
		}

		$tt           = $wpdb->prefix . self::$table;
		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, workspace_id FROM `{$tt}` WHERE id IN ({$placeholders})", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
				...$ids
			),
			ARRAY_A
		);

		$map = [];
		foreach ( $rows ?? [] as $r ) {
			$map[ (int) $r['id'] ] = (int) $r['workspace_id'];
		}

		return $map;
	}

	/**
	 * Batch-fetch subtask totals for many tasks.
	 *
	 * @since 0.2.0
	 *
	 * @param array<int, int> $task_ids
	 * @return array<int, array{total: int, completed: int}>
	 */
	public static function get_subtask_counts_for( array $task_ids ): array {
		global $wpdb;

		$ids = array_values( array_unique( array_filter( array_map( 'intval', $task_ids ) ) ) );
		$map = array_fill_keys(
			$ids,
			[
				'total'     => 0,
				'completed' => 0,
			]
		);

		if ( empty( $ids ) ) {
			return $map;
		}

		$st           = $wpdb->prefix . 'st_todox_subtasks';
		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT task_id, COUNT(*) AS total, SUM(completed = 1) AS completed FROM `{$st}` WHERE task_id IN ({$placeholders}) GROUP BY task_id", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
				...$ids
			),
			ARRAY_A
		);

		foreach ( $rows ?? [] as $r ) {
			$map[ (int) $r['task_id'] ] = [
				'total'     => (int) $r['total'],
				'completed' => (int) $r['completed'],
			];
		}

		return $map;
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

		$workspace_id = ! empty( $data['workspace_id'] ) ? (int) $data['workspace_id'] : 0;
		if ( $workspace_id <= 0 ) {
			return false;
		}

		// Determine position (append to end of sprint/project).
		$position = self::get_next_position( $data );

		$status_id = ! empty( $data['status_id'] )
			? (int) $data['status_id']
			: self::resolve_status_id( self::sanitize_status( $data['status'] ?? 'todo' ), $workspace_id );

		$inserted = $wpdb->insert( // phpcs:ignore
			$wpdb->prefix . self::$table,
			[
				'sprint_id'    => isset( $data['sprint_id'] ) ? (int) $data['sprint_id'] : null,
				'project_id'   => isset( $data['project_id'] ) ? (int) $data['project_id'] : null,
				'workspace_id' => $workspace_id,
				'title'        => sanitize_text_field( $data['title'] ),
				'description'  => isset( $data['description'] ) ? wp_kses_post( $data['description'] ) : null,
				'status_id'    => $status_id,
				'priority'     => self::valid_priority( $data['priority'] ?? 'medium' ),
				'start_date'   => self::valid_date( $data['start_date'] ?? null ),
				'due_date'     => self::valid_date( $data['due_date'] ?? null ),
				'position'     => $position,
				'assignee_id'  => self::valid_member( $data['assignee_id'] ?? null, $workspace_id ),
				'creator_id'   => (int) $data['creator_id'],
				'label_ids'    => self::encode_label_ids( $data['label_ids'] ?? [] ),
			]
		);

		if ( ! $inserted ) {
			return false;
		}

		$task_id = (int) $wpdb->insert_id;

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

		$before = self::get( $id, [] );
		if ( ! $before ) {
			return false;
		}

		$workspace_id = (int) ( $before['workspace_id'] ?? 0 );

		$allowed = [ 'title', 'description', 'status', 'status_id', 'priority', 'start_date', 'due_date', 'assignee_id', 'sprint_id', 'position', 'is_archived', 'label_ids' ];
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
					$update['status_id'] = self::resolve_status_id( self::sanitize_status( $data['status'] ), $workspace_id );
					break;
				case 'status_id':
					$update['status_id'] = $data['status_id'] !== null ? (int) $data['status_id'] : null;
					break;
				case 'priority':
					$update['priority'] = self::valid_priority( $data['priority'] );
					break;
				case 'assignee_id':
					$update['assignee_id'] = self::valid_member( $data['assignee_id'], $workspace_id );
					break;
				case 'sprint_id':
				case 'position':
					$update[ $field ] = $data[ $field ] !== null ? (int) $data[ $field ] : null;
					break;
				case 'start_date':
					$update['start_date'] = self::valid_date( $data['start_date'] );
					break;
				case 'due_date':
					$update['due_date'] = self::valid_date( $data['due_date'] );
					break;
				case 'is_archived':
					$update['is_archived'] = (int) $data['is_archived'];
					break;
				case 'label_ids':
					$update['label_ids'] = self::encode_label_ids( $data['label_ids'] );
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

		// Activity logging — emit one entry per changed tracked field.
		if ( $user_id ) {
			self::log_field_changes( $id, $user_id, $before, $update );
		}

		return $result;
	}

	/**
	 * Emit TaskActivity entries for each tracked field that actually changed.
	 *
	 * @since 0.2.0
	 *
	 * @param array<string, mixed> $before
	 * @param array<string, mixed> $update
	 */
	private static function log_field_changes( int $task_id, int $user_id, array $before, array $update ): void {
		$tracked = [
			'status_id'   => 'status_changed',
			'priority'    => 'priority_changed',
			'assignee_id' => 'assignee_changed',
			'due_date'    => 'due_date_changed',
			'sprint_id'   => 'sprint_changed',
			'is_archived' => 'archive_changed',
		];

		foreach ( $tracked as $field => $action ) {
			if ( ! array_key_exists( $field, $update ) ) {
				continue;
			}

			$new_value = $update[ $field ];
			$old_value = $before[ $field ] ?? null;

			// Normalize for comparison.
			if ( in_array( $field, [ 'status_id', 'assignee_id', 'sprint_id' ], true ) ) {
				$old_value = $old_value !== null ? (int) $old_value : null;
				$new_value = $new_value !== null ? (int) $new_value : null;
			} elseif ( $field === 'is_archived' ) {
				$old_value = (int) (bool) $old_value;
				$new_value = (int) $new_value;
			}

			if ( $old_value === $new_value ) {
				continue;
			}

			$detail = $new_value === null ? null : (string) $new_value;
			TaskActivity::log( $task_id, $user_id, $action, $detail );
		}
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
	 * Updates all rows in a single statement using CASE WHEN. All `$items`
	 * must belong to `$workspace_id`; foreign IDs are silently skipped.
	 *
	 * @since 0.1.0
	 *
	 * @param array<int, array{id: int, position: int, status?: string}> $items
	 */
	public static function reorder( array $items, int $workspace_id ): bool {
		global $wpdb;

		if ( $workspace_id <= 0 || empty( $items ) ) {
			return false;
		}

		// Build maps of id => position/status, only for tasks in this workspace.
		$ids = array_values(
			array_filter(
				array_map(
					static fn( $i ) => isset( $i['id'] ) ? (int) $i['id'] : 0,
					$items
				)
			)
		);
		$ownership = self::get_workspace_ids( $ids );

		$position_map = [];
		$status_map   = [];
		$valid_ids    = [];

		foreach ( $items as $item ) {
			$id = isset( $item['id'] ) ? (int) $item['id'] : 0;
			if ( $id <= 0 || ( $ownership[ $id ] ?? 0 ) !== $workspace_id ) {
				continue;
			}
			$valid_ids[]         = $id;
			$position_map[ $id ] = (int) ( $item['position'] ?? 0 );
			if ( array_key_exists( 'status', $item ) ) {
				$sid = self::resolve_status_id( self::sanitize_status( (string) $item['status'] ), $workspace_id );
				if ( $sid ) {
					$status_map[ $id ] = $sid;
				}
			}
		}

		if ( empty( $valid_ids ) ) {
			return false;
		}

		$tt           = $wpdb->prefix . self::$table;
		$placeholders = implode( ',', array_fill( 0, count( $valid_ids ), '%d' ) );

		$position_case = 'CASE id';
		$values        = [];
		foreach ( $position_map as $id => $pos ) {
			$position_case .= ' WHEN %d THEN %d';
			$values[]       = $id;
			$values[]       = $pos;
		}
		$position_case .= ' ELSE position END';

		$status_sql = '';
		if ( ! empty( $status_map ) ) {
			$status_case = 'CASE id';
			foreach ( $status_map as $id => $status_id ) {
				$status_case .= ' WHEN %d THEN %d';
				$values[]     = $id;
				$values[]     = $status_id;
			}
			$status_case .= ' ELSE status_id END';
			$status_sql   = ", status_id = {$status_case}";
		}

		$values = array_merge( $values, $valid_ids );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		$wpdb->query(
			$wpdb->prepare(
				"UPDATE `{$tt}` SET position = {$position_case}{$status_sql} WHERE id IN ({$placeholders})", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
				...$values
			)
		);

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

		$tt     = $wpdb->prefix . self::$table;
		$tt_tax = $wpdb->prefix . 'st_todox_taxonomies';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT COALESCE(tx.slug, %s) as status, COUNT(*) as count FROM %i t LEFT JOIN %i tx ON tx.id = t.status_id WHERE t.workspace_id = %d AND t.is_archived = 0 GROUP BY t.status_id',
				'todo',
				$tt,
				$tt_tax,
				$workspace_id
			),
			ARRAY_A
		);

		$stats = [
			'total'       => 0,
			'todo'        => 0,
			'in_progress' => 0,
			'review'      => 0,
			'completed'   => 0,
			'overdue'     => 0,
		];

		foreach ( $rows as $row ) {
			$key = $row['status'];
			if ( isset( $stats[ $key ] ) ) {
				$stats[ $key ] = (int) $row['count'];
			}
			$stats['total'] += (int) $row['count'];
		}

		// Overdue: tasks whose status is not 'completed' and due_date is past.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$stats['overdue'] = (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM %i t LEFT JOIN %i tx ON tx.id = t.status_id WHERE t.workspace_id = %d AND t.is_archived = 0 AND ( tx.slug IS NULL OR tx.slug != %s ) AND t.due_date < CURDATE()',
				$tt,
				$tt_tax,
				$workspace_id,
				'completed'
			)
		);

		return $stats;
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

	/**
	 * Sanitize a status slug to lowercase alphanumeric + underscore.
	 */
	private static function sanitize_status( string $status ): string {
		$slug = strtolower( trim( preg_replace( '/[^a-z0-9_]+/i', '_', $status ) ) );
		return $slug !== '' ? $slug : 'todo';
	}

	/**
	 * Resolve a taxonomy ID for the given status category slug + workspace.
	 * Prefers workspace-specific entry; falls back to global (workspace_id IS NULL).
	 * Returns null if no matching taxonomy entry is found.
	 */
	private static function resolve_status_id( string $slug, int $workspace_id ): ?int {
		static $cache = [];
		$key = $workspace_id . ':' . $slug;
		if ( array_key_exists( $key, $cache ) ) {
			return $cache[ $key ];
		}

		global $wpdb;
		$table = $wpdb->prefix . 'st_todox_taxonomies';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$id = $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM %i WHERE type = %s AND slug = %s AND ( workspace_id = %d OR workspace_id IS NULL ) AND is_active = 1 ORDER BY workspace_id DESC LIMIT 1',
				$table,
				'task_status',
				$slug,
				$workspace_id
			)
		);

		$cache[ $key ] = $id ? (int) $id : null;
		return $cache[ $key ];
	}

	/**
	 * Resolve the status category slug for a given taxonomy ID.
	 * Returns 'todo' as fallback when the ID is not found.
	 */
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

		$cache[ $status_id ] = $slug ?? 'todo';
		return $cache[ $status_id ];
	}

	private static function valid_priority( string $priority ): string {
		return in_array( $priority, [ 'low', 'medium', 'high', 'urgent' ], true ) ? $priority : 'medium';
	}

	/**
	 * Validate that an assignee belongs to the workspace. Returns null otherwise.
	 */
	private static function valid_member( mixed $user_id, int $workspace_id ): ?int {
		if ( $user_id === null || $user_id === '' ) {
			return null;
		}
		$uid = (int) $user_id;
		if ( $uid <= 0 ) {
			return null;
		}

		return Workspace::is_member( $workspace_id, $uid ) ? $uid : null;
	}

	/**
	 * Accept MySQL DATE/DATETIME strings. Return null for invalid input.
	 */
	private static function valid_date( mixed $value ): ?string {
		if ( empty( $value ) ) {
			return null;
		}
		$ts = strtotime( (string) $value );
		if ( ! $ts ) {
			return null;
		}
		return gmdate( 'Y-m-d', $ts );
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
		$ids       = isset( $row['label_ids'] ) && $row['label_ids'] !== null
			? array_values( array_filter( array_map( 'intval', json_decode( $row['label_ids'], true ) ?? [] ) ) )
			: [];
		$status_id = isset( $row['status_id'] ) && $row['status_id'] ? (int) $row['status_id'] : null;
		$status    = $status_id ? self::resolve_status_slug( $status_id ) : 'todo';

		return [
			'id'           => (int) $row['id'],
			'sprint_id'    => $row['sprint_id'] ? (int) $row['sprint_id'] : null,
			'project_id'   => $row['project_id'] ? (int) $row['project_id'] : null,
			'workspace_id' => $row['workspace_id'] ? (int) $row['workspace_id'] : null,
			'title'        => $row['title'],
			'description'  => $row['description'],
			'status_id'    => $status_id,
			'status'       => $status,
			'label_ids'    => $ids,
			'labels'       => [],
			'priority'     => $row['priority'],
			'start_date'   => $row['start_date'],
			'due_date'     => $row['due_date'],
			'position'     => (int) $row['position'],
			'is_archived'  => (bool) $row['is_archived'],
			'assignee_id'  => $row['assignee_id'] ? (int) $row['assignee_id'] : null,
			'assignee'     => $row['assignee_id'] ? Fns::get_user_info( (int) $row['assignee_id'] ) : null,
			'creator_id'   => (int) $row['creator_id'],
			'creator'      => Fns::get_user_info( (int) $row['creator_id'] ),
			'created_at'   => Fns::format_datetime( $row['created_at'] ),
			'updated_at'   => Fns::format_datetime( $row['updated_at'] ),
		];
	}

	/**
	 * Resolve taxonomy labels for a set of IDs. Returns [{id, name, color}].
	 *
	 * @param array<int, int> $ids
	 * @return array<int, array<string, mixed>>
	 */
	public static function resolve_labels( array $ids ): array {
		$ids = array_values( array_unique( array_filter( array_map( 'intval', $ids ) ) ) );
		if ( empty( $ids ) ) {
			return [];
		}

		global $wpdb;

		$tt           = $wpdb->prefix . 'st_todox_taxonomies';
		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, name, color FROM `{$tt}` WHERE id IN ({$placeholders})", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
				...$ids
			),
			ARRAY_A
		);

		return array_map(
			fn( $r ) => [
				'id'    => (int) $r['id'],
				'name'  => $r['name'],
				'color' => $r['color'],
            ],
			$rows ?? []
		);
	}

	/**
	 * Encode label_ids array as JSON for DB storage.
	 *
	 * @param mixed $value
	 */
	private static function encode_label_ids( mixed $value ): ?string {
		if ( ! is_array( $value ) || empty( $value ) ) {
			return null;
		}
		$ids = array_values( array_filter( array_map( 'intval', $value ) ) );
		return $ids ? wp_json_encode( $ids ) : null;
	}
}
