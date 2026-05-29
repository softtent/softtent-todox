<?php

namespace SoftTent\TodoX\Api\Controllers;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Abstracts\RestApi;
use SoftTent\TodoX\Models\Sprint;
use SoftTent\TodoX\Models\Project;
use SoftTent\TodoX\Traits\Sanitizer;

/**
 * REST controller for sprints.
 *
 * @since 0.1.0
 */
class SprintController extends RestApi {

	use Sanitizer;

	protected $base = 'sprints';

	public function routes(): void {
		$by_id = function ( \WP_REST_Request $req ) {
			$ws_id = Sprint::get_workspace_id( (int) $req->get_param( 'id' ) );
			if ( $ws_id === null ) {
				return new \WP_Error( 'rest_not_found', esc_html__( 'Sprint not found.', 'softtent-todox' ), [ 'status' => 404 ] );
			}
			return $this->can_access_workspace( $ws_id );
		};

		$by_project_id = function ( \WP_REST_Request $req ) {
			$ws_id = Project::get_workspace_id( (int) $req->get_param( 'project_id' ) );
			if ( $ws_id === null ) {
				return new \WP_Error( 'rest_not_found', esc_html__( 'Project not found.', 'softtent-todox' ), [ 'status' => 404 ] );
			}
			return $this->can_access_workspace( $ws_id );
		};

		$by_reorder = function ( \WP_REST_Request $req ) {
			$items = $req->get_param( 'items' );
			if ( ! is_array( $items ) || empty( $items ) ) {
				return new \WP_Error( 'rest_invalid_items', esc_html__( 'Items array is required.', 'softtent-todox' ), [ 'status' => 400 ] );
			}
			$first_id = (int) ( $items[0]['id'] ?? 0 );
			$ws_id    = Sprint::get_workspace_id( $first_id );
			if ( $ws_id === null ) {
				return new \WP_Error( 'rest_not_found', esc_html__( 'Sprint not found.', 'softtent-todox' ), [ 'status' => 404 ] );
			}
			return $this->can_access_workspace( $ws_id );
		};

		register_rest_route(
            $this->namespace, '/' . $this->base, [
				[
					'methods' => 'GET',
					'callback' => [ $this, 'index' ],
					'permission_callback' => $by_project_id,
				],
				[
					'methods' => 'POST',
					'callback' => [ $this, 'store' ],
					'permission_callback' => $by_project_id,
				],
			]
        );

		register_rest_route(
            $this->namespace, '/' . $this->base . '/reorder', [
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'reorder' ],
					'permission_callback' => $by_reorder,
				],
			]
        );

		register_rest_route(
            $this->namespace, '/' . $this->base . '/(?P<id>\d+)', [
				[
					'methods' => 'GET',
					'callback' => [ $this, 'show' ],
					'permission_callback' => $by_id,
				],
				[
					'methods' => 'PUT',
					'callback' => [ $this, 'update' ],
					'permission_callback' => $by_id,
				],
				[
					'methods' => 'DELETE',
					'callback' => [ $this, 'destroy' ],
					'permission_callback' => $by_id,
				],
			]
        );
	}

	public function index( \WP_REST_Request $req ): \WP_REST_Response {
		$project_id = (int) ( $req->get_param( 'project_id' ) ?? 0 );

		if ( ! $project_id ) {
			return $this->error( esc_html__( 'project_id is required.', 'softtent-todox' ) );
		}

		return $this->ok(
            Sprint::get_all(
                $project_id, [
					'status' => $req->get_param( 'status' ),
				]
            )
        );
	}

	public function show( \WP_REST_Request $req ): \WP_REST_Response {
		$sprint = Sprint::get( (int) $req->get_param( 'id' ) );

		return $sprint
			? $this->ok( $sprint )
			: $this->error( esc_html__( 'Sprint not found.', 'softtent-todox' ), 404 );
	}

	public function store( \WP_REST_Request $req ): \WP_REST_Response {
		$name = $this->sanitize_text( $req->get_param( 'name' ) ?? '' );

		if ( empty( $name ) ) {
			return $this->error( esc_html__( 'Sprint name is required.', 'softtent-todox' ) );
		}

		if ( ! $req->get_param( 'project_id' ) ) {
			return $this->error( esc_html__( 'project_id is required.', 'softtent-todox' ) );
		}

		$id = Sprint::create(
            [
				'project_id' => $req->get_param( 'project_id' ),
				'name'       => $name,
				'goal'       => $req->get_param( 'goal' ),
				'status'     => $req->get_param( 'status' ),
				'status_id'  => $req->get_param( 'status_id' ),
				'start_date' => $req->get_param( 'start_date' ),
				'end_date'   => $req->get_param( 'end_date' ),
            ]
        );

		return $id
			? $this->ok( Sprint::get( $id ), esc_html__( 'Sprint created.', 'softtent-todox' ), 201 )
			: $this->error( esc_html__( 'Failed to create sprint.', 'softtent-todox' ) );
	}

	public function update( \WP_REST_Request $req ): \WP_REST_Response {
		$id = (int) $req->get_param( 'id' );

		Sprint::update( $id, $req->get_params() );

		return $this->ok( Sprint::get( $id ), esc_html__( 'Sprint updated.', 'softtent-todox' ) );
	}

	public function destroy( \WP_REST_Request $req ): \WP_REST_Response {
		Sprint::delete( (int) $req->get_param( 'id' ) );

		return $this->ok( null, esc_html__( 'Sprint deleted.', 'softtent-todox' ) );
	}

	public function reorder( \WP_REST_Request $req ): \WP_REST_Response {
		$items = $req->get_param( 'items' );

		if ( ! is_array( $items ) || empty( $items ) ) {
			return $this->error( esc_html__( 'Items array is required.', 'softtent-todox' ) );
		}

		Sprint::reorder( $items );

		return $this->ok( null, esc_html__( 'Sprints reordered.', 'softtent-todox' ) );
	}
}
