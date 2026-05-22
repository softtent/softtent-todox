<?php

namespace SoftTent\TodoX\Api\Controllers;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Abstracts\RestApi;
use SoftTent\TodoX\Models\Project;
use SoftTent\TodoX\Traits\Sanitizer;

/**
 * REST controller for projects.
 *
 * @since 0.1.0
 */
class ProjectController extends RestApi {

	use Sanitizer;

	protected $base = 'projects';

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
            Project::get_all(
                $workspace_id, [
					'team_id' => $req->get_param( 'team_id' ),
					'status'  => $req->get_param( 'status' ),
					'search'  => $req->get_param( 'search' ),
				]
            )
        );
	}

	public function show( \WP_REST_Request $req ): \WP_REST_Response {
		$project = Project::get( (int) $req->get_param( 'id' ) );

		return $project
			? $this->ok( $project )
			: $this->error( esc_html__( 'Project not found.', 'softtent-todox' ), 404 );
	}

	public function store( \WP_REST_Request $req ): \WP_REST_Response {
		$name = $this->sanitize_text( $req->get_param( 'name' ) ?? '' );
		$workspace_id = (int) $req->get_param( 'workspace_id' );
		$team_id = (int) $req->get_param( 'team_id' );

		if ( empty( $name ) ) {
			return $this->error( esc_html__( 'Project name is required.', 'softtent-todox' ) );
		}

		if ( empty( $workspace_id ) ) {
			return $this->error( esc_html__( 'Workspace ID is required.', 'softtent-todox' ) );
		}

		if ( empty( $team_id ) ) {
			return $this->error( esc_html__( 'Team ID is required.', 'softtent-todox' ) );
		}

		$id = Project::create(
            [
				'name'         => $name,
				'workspace_id' => $workspace_id,
				'team_id'      => $team_id,
				'owner_id'     => $this->current_user_id(),
				'description'  => $this->sanitize_textarea( $req->get_param( 'description' ) ?? '' ),
				'color'        => $this->sanitize_color( $req->get_param( 'color' ) ),
				'icon'         => $this->sanitize_text( $req->get_param( 'icon' ) ?? '' ),
				'taxonomy_id'  => $this->sanitize_int( $req->get_param( 'taxonomy_id' ) ),
				'status'       => $this->sanitize_enum( $req->get_param( 'status' ), [ 'active', 'completed', 'archived' ], 'active' ),
			]
        );

		return $id
			? $this->ok( Project::get( $id ), esc_html__( 'Project created.', 'softtent-todox' ), 201 )
			: $this->error( esc_html__( 'Failed to create project.', 'softtent-todox' ) );
	}

	public function update( \WP_REST_Request $req ): \WP_REST_Response {
		$id = (int) $req->get_param( 'id' );

		Project::update( $id, $req->get_params() );

		return $this->ok( Project::get( $id ), esc_html__( 'Project updated.', 'softtent-todox' ) );
	}

	public function destroy( \WP_REST_Request $req ): \WP_REST_Response {
		Project::delete( (int) $req->get_param( 'id' ) );

		return $this->ok( null, esc_html__( 'Project deleted.', 'softtent-todox' ) );
	}
}
