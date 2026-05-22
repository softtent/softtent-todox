<?php

namespace SoftTent\TodoX\Api\Controllers;

defined( 'ABSPATH' ) || exit;

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
		register_rest_route(
            $this->namespace, '/' . $this->base, [
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'index' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'store' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
			]
        );

		register_rest_route(
            $this->namespace, '/' . $this->base . '/reorder', [
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'reorder' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
			]
        );

		register_rest_route(
            $this->namespace, '/' . $this->base . '/(?P<id>\d+)', [
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'show' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
				[
					'methods'             => 'PUT',
					'callback'            => [ $this, 'update' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
				[
					'methods'             => 'DELETE',
					'callback'            => [ $this, 'destroy' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
			]
        );

		register_rest_route(
            $this->namespace, '/' . $this->base . '/(?P<id>\d+)/comments', [
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_comments' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'add_comment' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
			]
        );

		register_rest_route(
            $this->namespace, '/' . $this->base . '/(?P<id>\d+)/comments/(?P<comment_id>\d+)', [
				[
					'methods'             => 'PUT',
					'callback'            => [ $this, 'update_comment' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
				[
					'methods'             => 'DELETE',
					'callback'            => [ $this, 'delete_comment' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
			]
        );

		register_rest_route(
            $this->namespace, '/' . $this->base . '/(?P<id>\d+)/activities', [
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_activities' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
			]
        );
	}

	public function index( \WP_REST_Request $req ): \WP_REST_Response {
		$pagination = Fns::get_pagination( $req );

		$result = Task::get_all(
            [
				'workspace_id' => $req->get_param( 'workspace_id' ),
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

		// Attach labels to list items.
		foreach ( $result['items'] as &$task ) {
			$task['labels'] = Task::get_labels( $task['id'] );
		}
		unset( $task );

		return $this->ok(
            [
				'items'      => $result['items'],
				'total'      => $result['total'],
				'page'       => $pagination['page'],
				'per_page'   => $pagination['per_page'],
				'total_pages' => (int) ceil( $result['total'] / $pagination['per_page'] ),
			]
        );
	}

	public function show( \WP_REST_Request $req ): \WP_REST_Response {
		$task = Task::get( (int) $req->get_param( 'id' ) );

		if ( ! $task ) {
			return $this->error( esc_html__( 'Task not found.', 'softtent-todox' ), 404 );
		}

		return $this->ok( $task );
	}

	public function store( \WP_REST_Request $req ): \WP_REST_Response {
		$title = $this->sanitize_text( $req->get_param( 'title' ) ?? '' );

		if ( empty( $title ) ) {
			return $this->error( esc_html__( 'Task title is required.', 'softtent-todox' ) );
		}

		$id = Task::create(
            array_merge(
                $req->get_params(),
                [
					'title'      => $title,
					'creator_id' => $this->current_user_id(),
                ]
            )
        );

		if ( ! $id ) {
			return $this->error( esc_html__( 'Failed to create task.', 'softtent-todox' ) );
		}

		return $this->ok( Task::get( $id ), esc_html__( 'Task created.', 'softtent-todox' ), 201 );
	}

	public function update( \WP_REST_Request $req ): \WP_REST_Response {
		$id   = (int) $req->get_param( 'id' );
		$task = Task::get( $id );

		if ( ! $task ) {
			return $this->error( esc_html__( 'Task not found.', 'softtent-todox' ), 404 );
		}

		Task::update( $id, $req->get_params(), $this->current_user_id() );

		return $this->ok( Task::get( $id ), esc_html__( 'Task updated.', 'softtent-todox' ) );
	}

	public function destroy( \WP_REST_Request $req ): \WP_REST_Response {
		$id   = (int) $req->get_param( 'id' );
		$task = Task::get( $id );

		if ( ! $task ) {
			return $this->error( esc_html__( 'Task not found.', 'softtent-todox' ), 404 );
		}

		Task::delete( $id );

		return $this->ok( null, esc_html__( 'Task deleted.', 'softtent-todox' ) );
	}

	public function reorder( \WP_REST_Request $req ): \WP_REST_Response {
		$items = $req->get_param( 'items' );

		if ( ! is_array( $items ) ) {
			return $this->error( esc_html__( 'Items array is required.', 'softtent-todox' ) );
		}

		Task::reorder( $items );

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
