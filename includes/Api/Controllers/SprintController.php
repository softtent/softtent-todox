<?php

namespace SoftTent\TodoX\Api\Controllers;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Abstracts\RestApi;
use SoftTent\TodoX\Models\Sprint;
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
		register_rest_route(
            $this->namespace, '/' . $this->base, [
				[
					'methods' => 'GET',
					'callback' => [ $this, 'index' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
				[
					'methods' => 'POST',
					'callback' => [ $this, 'store' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
			]
        );

		register_rest_route(
            $this->namespace, '/' . $this->base . '/(?P<id>\d+)', [
				[
					'methods' => 'GET',
					'callback' => [ $this, 'show' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
				[
					'methods' => 'PUT',
					'callback' => [ $this, 'update' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
				[
					'methods' => 'DELETE',
					'callback' => [ $this, 'destroy' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
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

		$id = Sprint::create( array_merge( $req->get_params(), [ 'name' => $name ] ) );

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
}
