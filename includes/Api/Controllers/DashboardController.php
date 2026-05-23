<?php

namespace SoftTent\TodoX\Api\Controllers;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Abstracts\RestApi;
use SoftTent\TodoX\Models\Task;
use SoftTent\TodoX\Models\Project;
use SoftTent\TodoX\Helpers\Fns;

/**
 * REST controller for dashboard analytics.
 *
 * @since 0.1.0
 */
class DashboardController extends RestApi {

	protected $base = 'dashboard';

	public function routes(): void {
		register_rest_route(
            $this->namespace, '/' . $this->base . '/stats', [
				[
					'methods' => 'GET',
					'callback' => [ $this, 'stats' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
			]
        );

		register_rest_route(
            $this->namespace, '/' . $this->base . '/recent-tasks', [
				[
					'methods' => 'GET',
					'callback' => [ $this, 'recent_tasks' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
			]
        );

		register_rest_route(
            $this->namespace, '/' . $this->base . '/recent-activity', [
				[
					'methods' => 'GET',
					'callback' => [ $this, 'recent_activity' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
			]
        );
	}

	public function stats( \WP_REST_Request $req ): \WP_REST_Response {
		$workspace_id = (int) ( $req->get_param( 'workspace_id' ) ?? 0 );

		if ( ! $workspace_id ) {
			return $this->error( esc_html__( 'workspace_id is required.', 'softtent-todox' ) );
		}

		$task_stats = Task::get_stats( $workspace_id );

		$projects_count = Project::count( $workspace_id );

		return $this->ok(
            [
				'tasks'    => $task_stats,
				'projects' => $projects_count,
			]
        );
	}

	public function recent_tasks( \WP_REST_Request $req ): \WP_REST_Response {
		$workspace_id = (int) ( $req->get_param( 'workspace_id' ) ?? 0 );

		if ( ! $workspace_id ) {
			return $this->error( esc_html__( 'workspace_id is required.', 'softtent-todox' ) );
		}

		$result = Task::get_all(
            [
				'workspace_id' => $workspace_id,
				'order_by'     => 'created_at',
				'order'        => 'desc',
				'per_page'     => 10,
				'offset'       => 0,
			]
        );

		foreach ( $result['items'] as &$task ) {
			$task['labels'] = Task::resolve_labels( $task['label_ids'] ?? [] );
		}
		unset( $task );

		return $this->ok( $result['items'] );
	}

	public function recent_activity( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;

		$workspace_id = (int) ( $req->get_param( 'workspace_id' ) ?? 0 );
		$limit        = min( (int) ( $req->get_param( 'limit' ) ?? 8 ), 20 );

		if ( ! $workspace_id ) {
			return $this->error( esc_html__( 'workspace_id is required.', 'softtent-todox' ) );
		}

		// Use caching for recent activity to reduce database queries.
		$cache_key = 'dashboard_activity_' . $workspace_id . '_' . $limit;
		$cached    = wp_cache_get( $cache_key, 'softtent-todox' );

		if ( false !== $cached ) {
			return $this->ok( $cached );
		}

		$table_activities = $wpdb->prefix . 'st_todox_task_activities';
		$table_tasks      = $wpdb->prefix . 'st_todox_tasks';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT a.*, t.title as task_title, t.id as task_id_ref
				FROM %i a
				INNER JOIN %i t ON t.id = a.task_id
				WHERE t.workspace_id = %d AND t.is_archived = 0
				ORDER BY a.created_at DESC
				LIMIT %d',
				$table_activities,
				$table_tasks,
				$workspace_id,
				$limit
			),
			ARRAY_A
		);

		if ( ! $rows ) {
			return $this->ok( [] );
		}

		$activities = array_map(
            function ( $row ) {
                return [
					'id'         => (int) $row['id'],
					'task_id'    => (int) $row['task_id'],
					'task_title' => $row['task_title'],
					'user_id'    => (int) $row['user_id'],
					'user'       => Fns::get_user_info( (int) $row['user_id'] ),
					'action'     => $row['action'],
					'detail'     => $row['detail'],
					'created_at' => Fns::format_datetime( $row['created_at'] ),
                ];
            }, $rows
        );

		wp_cache_set( $cache_key, $activities, 'softtent-todox', 30 ); // Cache for 30 seconds.

		return $this->ok( $activities );
	}
}
