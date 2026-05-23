<?php

namespace SoftTent\TodoX\Api\Controllers;

defined( 'ABSPATH' ) || exit;

use WP_Error;
use SoftTent\TodoX\Abstracts\RestApi;
use SoftTent\TodoX\Models\Task;
use SoftTent\TodoX\Models\TaskComment;
use SoftTent\TodoX\Models\TaskActivity;
use SoftTent\TodoX\Helpers\Fns;
use SoftTent\TodoX\Traits\Sanitizer;

/**
 * REST controller for tasks.
 *
 * Routes:
 *   GET    /todox/v1/tasks
 *   POST   /todox/v1/tasks
 *   GET    /todox/v1/tasks/:id
 *   PUT    /todox/v1/tasks/:id
 *   DELETE /todox/v1/tasks/:id
 *   POST   /todox/v1/tasks/:id/comments
 *   GET    /todox/v1/tasks/:id/activities
 *   POST   /todox/v1/tasks/reorder
 *
 * @since 0.1.0
 */
class TaskController extends RestApi {

	use Sanitizer;

	protected $base = 'tasks';

	public function routes(): void {
		$by_workspace_param = function ( \WP_REST_Request $req ) {
			return $this->can_access_workspace( (int) ( $req->get_param( 'workspace_id' ) ?? 0 ) );
		};

		$by_task_id = function ( \WP_REST_Request $req ) {
			$workspace_id = Task::get_workspace_id( (int) $req->get_param( 'id' ) );
			if ( $workspace_id === null ) {
				return new WP_Error(
					'rest_task_not_found',
					esc_html__( 'Task not found.', 'softtent-todox' ),
					[ 'status' => 404 ]
				);
			}
			return $this->can_access_workspace( $workspace_id );
		};

		$by_reorder_items = function ( \WP_REST_Request $req ) {
			$items = $req->get_param( 'items' );
			if ( ! is_array( $items ) || empty( $items ) ) {
				return new WP_Error(
					'rest_invalid_items',
					esc_html__( 'Items array is required.', 'softtent-todox' ),
					[ 'status' => 400 ]
				);
			}

			$ids = array_filter( array_map( static fn( $i ) => isset( $i['id'] ) ? (int) $i['id'] : 0, $items ) );
			if ( empty( $ids ) ) {
				return new WP_Error( 'rest_invalid_items', esc_html__( 'Items array is required.', 'softtent-todox' ), [ 'status' => 400 ] );
			}

			$ws_ids = array_unique( array_values( Task::get_workspace_ids( $ids ) ) );
			if ( count( $ws_ids ) !== 1 ) {
				return new WP_Error(
					'rest_forbidden',
					esc_html__( 'Tasks must belong to a single workspace.', 'softtent-todox' ),
					[ 'status' => 403 ]
				);
			}

			return $this->can_access_workspace( (int) $ws_ids[0] );
		};

		register_rest_route(
            $this->namespace, '/' . $this->base, [
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'index' ],
					'permission_callback' => $by_workspace_param,
				],
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'store' ],
					'permission_callback' => $by_workspace_param,
				],
			]
        );

		register_rest_route(
            $this->namespace, '/' . $this->base . '/reorder', [
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'reorder' ],
					'permission_callback' => $by_reorder_items,
				],
			]
        );

		register_rest_route(
            $this->namespace, '/' . $this->base . '/(?P<id>\d+)', [
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'show' ],
					'permission_callback' => $by_task_id,
				],
				[
					'methods'             => 'PUT',
					'callback'            => [ $this, 'update' ],
					'permission_callback' => $by_task_id,
				],
				[
					'methods'             => 'DELETE',
					'callback'            => [ $this, 'destroy' ],
					'permission_callback' => $by_task_id,
				],
			]
        );

		register_rest_route(
            $this->namespace, '/' . $this->base . '/(?P<id>\d+)/comments', [
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_comments' ],
					'permission_callback' => $by_task_id,
				],
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'add_comment' ],
					'permission_callback' => $by_task_id,
				],
			]
        );

		register_rest_route(
            $this->namespace, '/' . $this->base . '/(?P<id>\d+)/comments/(?P<comment_id>\d+)', [
				[
					'methods'             => 'PUT',
					'callback'            => [ $this, 'update_comment' ],
					'permission_callback' => $by_task_id,
				],
				[
					'methods'             => 'DELETE',
					'callback'            => [ $this, 'delete_comment' ],
					'permission_callback' => $by_task_id,
				],
			]
        );

		register_rest_route(
            $this->namespace, '/' . $this->base . '/(?P<id>\d+)/activities', [
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_activities' ],
					'permission_callback' => $by_task_id,
				],
			]
        );
	}

	public function index( \WP_REST_Request $req ): \WP_REST_Response {
		$pagination   = Fns::get_pagination( $req );
		$workspace_id = (int) $req->get_param( 'workspace_id' );

		if ( $workspace_id <= 0 ) {
			return $this->error( esc_html__( 'Workspace is required.', 'softtent-todox' ) );
		}

		$result = Task::get_all(
            [
				'workspace_id' => $workspace_id,
				'project_id'   => $req->get_param( 'project_id' ),
				'sprint_id'    => $req->get_param( 'sprint_id' ),
				'status'       => $req->get_param( 'status' ),
				'priority'     => $req->get_param( 'priority' ),
				'assignee_id'  => $req->get_param( 'assignee_id' ),
				'search'       => $req->get_param( 'search' ),
				'order_by'     => $req->get_param( 'order_by' ) ?? 'position',
				'order'        => $req->get_param( 'order' ) ?? 'asc',
				'per_page'     => $pagination['per_page'],
				'offset'       => $pagination['offset'],
			]
        );

		// Batch-attach labels and subtask counts to list items.
		$ids      = array_map( static fn( $t ) => (int) $t['id'], $result['items'] );
		$subtasks = Task::get_subtask_counts_for( $ids );

		// Collect all unique label taxonomy IDs across all tasks, resolve once.
		$all_label_ids = array_values( array_unique( array_merge( ...array_map( static fn( $t ) => $t['label_ids'] ?? [], $result['items'] ) ) ) );
		$label_map     = [];
		foreach ( Task::resolve_labels( $all_label_ids ) as $label ) {
			$label_map[ $label['id'] ] = $label;
		}

		foreach ( $result['items'] as &$task ) {
			$task['labels']         = array_values( array_filter( array_map( static fn( $id ) => $label_map[ $id ] ?? null, $task['label_ids'] ?? [] ) ) );
			$task['subtask_counts'] = $subtasks[ (int) $task['id'] ] ?? [
				'total'     => 0,
				'completed' => 0,
			];
		}
		unset( $task );

		$per_page = (int) $pagination['per_page'];

		return $this->ok(
            [
				'items'       => $result['items'],
				'total'       => $result['total'],
				'page'        => $pagination['page'],
				'per_page'    => $per_page,
				'total_pages' => $per_page > 0 ? (int) ceil( $result['total'] / $per_page ) : 0,
			]
        );
	}

	public function show( \WP_REST_Request $req ): \WP_REST_Response {
		$task = Task::get(
			(int) $req->get_param( 'id' ),
			[ 'subtasks', 'comments', 'activities' ]
		);

		if ( ! $task ) {
			return $this->error( esc_html__( 'Task not found.', 'softtent-todox' ), 404 );
		}

		return $this->ok( $task );
	}

	public function store( \WP_REST_Request $req ): \WP_REST_Response {
		$workspace_id = (int) $req->get_param( 'workspace_id' );

		if ( ! $workspace_id ) {
			return $this->error( esc_html__( 'Workspace is required.', 'softtent-todox' ) );
		}

		$title = $this->sanitize_text( $req->get_param( 'title' ) ?? '' );

		if ( empty( $title ) ) {
			return $this->error( esc_html__( 'Task title is required.', 'softtent-todox' ) );
		}

		$id = Task::create(
            [
				'workspace_id' => $workspace_id,
				'project_id'   => $req->get_param( 'project_id' ),
				'sprint_id'    => $req->get_param( 'sprint_id' ),
				'title'        => $title,
				'description'  => $req->get_param( 'description' ),
				'status'       => $req->get_param( 'status' ),
				'status_id'    => $req->get_param( 'status_id' ),
				'priority'     => $req->get_param( 'priority' ) ?? 'medium',
				'start_date'   => $req->get_param( 'start_date' ),
				'due_date'     => $req->get_param( 'due_date' ),
				'assignee_id'  => $req->get_param( 'assignee_id' ),
				'label_ids'    => $req->get_param( 'label_ids' ),
				'creator_id'   => $this->current_user_id(),
            ]
        );

		if ( ! $id ) {
			return $this->error( esc_html__( 'Failed to create task.', 'softtent-todox' ) );
		}

		return $this->ok( Task::get( $id ), esc_html__( 'Task created.', 'softtent-todox' ), 201 );
	}

	public function update( \WP_REST_Request $req ): \WP_REST_Response {
		$id   = (int) $req->get_param( 'id' );
		$task = Task::get( $id, [] );

		if ( ! $task ) {
			return $this->error( esc_html__( 'Task not found.', 'softtent-todox' ), 404 );
		}

		Task::update( $id, $req->get_params(), $this->current_user_id() );

		return $this->ok( Task::get( $id ), esc_html__( 'Task updated.', 'softtent-todox' ) );
	}

	public function destroy( \WP_REST_Request $req ): \WP_REST_Response {
		$id   = (int) $req->get_param( 'id' );
		$task = Task::get( $id, [] );

		if ( ! $task ) {
			return $this->error( esc_html__( 'Task not found.', 'softtent-todox' ), 404 );
		}

		Task::delete( $id );

		return $this->ok( null, esc_html__( 'Task deleted.', 'softtent-todox' ) );
	}

	public function reorder( \WP_REST_Request $req ): \WP_REST_Response {
		$items = $req->get_param( 'items' );

		if ( ! is_array( $items ) || empty( $items ) ) {
			return $this->error( esc_html__( 'Items array is required.', 'softtent-todox' ) );
		}

		// Permission check already verified all items belong to one workspace.
		$first_id     = (int) ( $items[0]['id'] ?? 0 );
		$workspace_id = (int) Task::get_workspace_id( $first_id );

		Task::reorder( $items, $workspace_id );

		return $this->ok( null, esc_html__( 'Tasks reordered.', 'softtent-todox' ) );
	}

	public function get_comments( \WP_REST_Request $req ): \WP_REST_Response {
		return $this->ok( TaskComment::get_all( (int) $req->get_param( 'id' ) ) );
	}

	public function add_comment( \WP_REST_Request $req ): \WP_REST_Response {
		$task_id = (int) $req->get_param( 'id' );
		$content = $req->get_param( 'content' ) ?? '';

		if ( empty( trim( $content ) ) ) {
			return $this->error( esc_html__( 'Comment content is required.', 'softtent-todox' ) );
		}

		$comment_id = TaskComment::create( $task_id, $this->current_user_id(), $content );

		return $this->ok(
			$comment_id ? TaskComment::get_all( $task_id ) : [],
			esc_html__( 'Comment added.', 'softtent-todox' ),
			201
		);
	}

	public function update_comment( \WP_REST_Request $req ): \WP_REST_Response {
		$comment_id = (int) $req->get_param( 'comment_id' );
		$content    = $req->get_param( 'content' ) ?? '';

		TaskComment::update( $comment_id, $content, $this->current_user_id() );

		return $this->ok( null, esc_html__( 'Comment updated.', 'softtent-todox' ) );
	}

	public function delete_comment( \WP_REST_Request $req ): \WP_REST_Response {
		$comment_id = (int) $req->get_param( 'comment_id' );

		TaskComment::delete( $comment_id, $this->current_user_id() );

		return $this->ok( null, esc_html__( 'Comment deleted.', 'softtent-todox' ) );
	}

	public function get_activities( \WP_REST_Request $req ): \WP_REST_Response {
		return $this->ok( TaskActivity::get_all( (int) $req->get_param( 'id' ) ) );
	}
}
