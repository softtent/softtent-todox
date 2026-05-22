<?php

namespace SoftTent\TodoX\Api\Controllers;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Abstracts\RestApi;
use SoftTent\TodoX\Models\Department;
use SoftTent\TodoX\Traits\Sanitizer;

/**
 * REST controller for departments.
 *
 * @since 0.1.0
 */
class DepartmentController extends RestApi {

	use Sanitizer;

	protected $base = 'departments';

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
		$workspace_id = (int) ( $req->get_param( 'workspace_id' ) ?? 0 );

		if ( ! $workspace_id ) {
			return $this->error( esc_html__( 'workspace_id is required.', 'softtent-todox' ) );
		}

		return $this->ok(
            Department::get_all(
                $workspace_id, [
					'search' => $req->get_param( 'search' ) ?? '',
				]
            )
        );
	}

	public function show( \WP_REST_Request $req ): \WP_REST_Response {
		$dept = Department::get( (int) $req->get_param( 'id' ) );

		return $dept ? $this->ok( $dept ) : $this->error( esc_html__( 'Department not found.', 'softtent-todox' ), 404 );
	}

	public function store( \WP_REST_Request $req ): \WP_REST_Response {
		$name = $this->sanitize_text( $req->get_param( 'name' ) ?? '' );

		if ( empty( $name ) ) {
			return $this->error( esc_html__( 'Department name is required.', 'softtent-todox' ) );
		}

		if ( ! $req->get_param( 'workspace_id' ) ) {
			return $this->error( esc_html__( 'workspace_id is required.', 'softtent-todox' ) );
		}

		$id = Department::create( array_merge( $req->get_params(), [ 'name' => $name ] ) );

		return $id
			? $this->ok( Department::get( $id ), esc_html__( 'Department created.', 'softtent-todox' ), 201 )
			: $this->error( esc_html__( 'Failed to create department.', 'softtent-todox' ) );
	}

	public function update( \WP_REST_Request $req ): \WP_REST_Response {
		$id = (int) $req->get_param( 'id' );

		Department::update( $id, $req->get_params() );

		return $this->ok( Department::get( $id ), esc_html__( 'Department updated.', 'softtent-todox' ) );
	}

	public function destroy( \WP_REST_Request $req ): \WP_REST_Response {
		Department::delete( (int) $req->get_param( 'id' ) );

		return $this->ok( null, esc_html__( 'Department deleted.', 'softtent-todox' ) );
	}
}
