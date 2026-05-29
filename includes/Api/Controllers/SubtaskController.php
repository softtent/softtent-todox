<?php

namespace SoftTent\TodoX\Api\Controllers;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Abstracts\RestApi;
use SoftTent\TodoX\Models\Subtask;
use SoftTent\TodoX\Models\Task;
use SoftTent\TodoX\Traits\Sanitizer;

/**
 * REST controller for subtasks.
 *
 * Routes under /tasks/:task_id/subtasks
 *
 * @since 0.1.0
 */
class SubtaskController extends RestApi {

	use Sanitizer;

	protected $base = 'tasks';

	public function routes(): void {
		$by_task_id = function ( \WP_REST_Request $req ) {
			$workspace_id = Task::get_workspace_id( (int) $req->get_param( 'task_id' ) );
			if ( $workspace_id === null ) {
				return new \WP_Error(
					'rest_task_not_found',
					esc_html__( 'Task not found.', 'softtent-todox' ),
					[ 'status' => 404 ]
				);
			}
			return $this->can_access_workspace( $workspace_id );
		};

		register_rest_route(
            $this->namespace, '/' . $this->base . '/(?P<task_id>\d+)/subtasks', [
				[
					'methods' => 'GET',
					'callback' => [ $this, 'index' ],
					'permission_callback' => $by_task_id,
				],
				[
					'methods' => 'POST',
					'callback' => [ $this, 'store' ],
					'permission_callback' => $by_task_id,
				],
			]
        );

		register_rest_route(
			$this->namespace, '/' . $this->base . '/(?P<task_id>\d+)/subtasks/reorder', [
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'reorder' ],
					'permission_callback' => $by_task_id,
				],
			]
		);

		register_rest_route(
            $this->namespace, '/' . $this->base . '/(?P<task_id>\d+)/subtasks/(?P<id>\d+)', [
				[
					'methods' => 'GET',
					'callback' => [ $this, 'show' ],
					'permission_callback' => $by_task_id,
				],
				[
					'methods' => 'PUT',
					'callback' => [ $this, 'update' ],
					'permission_callback' => $by_task_id,
				],
				[
					'methods' => 'DELETE',
					'callback' => [ $this, 'destroy' ],
					'permission_callback' => $by_task_id,
				],
			]
        );
	}

	public function index( \WP_REST_Request $req ): \WP_REST_Response {
		return $this->ok( Subtask::get_all( (int) $req->get_param( 'task_id' ) ) );
	}

	public function show( \WP_REST_Request $req ): \WP_REST_Response {
		$subtask = Subtask::get( (int) $req->get_param( 'id' ) );

		return $subtask
			? $this->ok( $subtask )
			: $this->error( esc_html__( 'Subtask not found.', 'softtent-todox' ), 404 );
	}

	public function store( \WP_REST_Request $req ): \WP_REST_Response {
		$task_id = (int) $req->get_param( 'task_id' );
		$title   = $this->sanitize_text( $req->get_param( 'title' ) ?? '' );

		if ( empty( $title ) ) {
			return $this->error( esc_html__( 'Subtask title is required.', 'softtent-todox' ) );
		}

		$id = Subtask::create( $task_id, array_merge( $req->get_params(), [ 'title' => $title ] ) );

		return $id
			? $this->ok( Subtask::get( $id ), esc_html__( 'Subtask created.', 'softtent-todox' ) )
			: $this->error( esc_html__( 'Failed to create subtask.', 'softtent-todox' ) );
	}

	public function update( \WP_REST_Request $req ): \WP_REST_Response {
		$id = (int) $req->get_param( 'id' );

		Subtask::update( $id, $req->get_params() );

		return $this->ok( Subtask::get( $id ), esc_html__( 'Subtask updated.', 'softtent-todox' ) );
	}

	public function reorder( \WP_REST_Request $req ): \WP_REST_Response {
		$items = $req->get_param( 'items' );

		if ( ! is_array( $items ) || empty( $items ) ) {
			return $this->error( esc_html__( 'Items array is required.', 'softtent-todox' ) );
		}

		Subtask::reorder( $items );

		return $this->ok( null, esc_html__( 'Subtasks reordered.', 'softtent-todox' ) );
	}

	public function destroy( \WP_REST_Request $req ): \WP_REST_Response {
		Subtask::delete( (int) $req->get_param( 'id' ) );

		return $this->ok( null, esc_html__( 'Subtask deleted.', 'softtent-todox' ) );
	}
}
