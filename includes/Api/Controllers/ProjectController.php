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
		$by_reorder = function ( \WP_REST_Request $req ) {
			$items = $req->get_param( 'items' );
			if ( ! is_array( $items ) || empty( $items ) ) {
				return new \WP_Error( 'rest_invalid_items', esc_html__( 'Items array is required.', 'softtent-todox' ), [ 'status' => 400 ] );
			}
			$first_id = (int) ( $items[0]['id'] ?? 0 );
			$ws_id    = Project::get_workspace_id( $first_id );
			return $ws_id ? $this->can_access_workspace( $ws_id ) : false;
		};

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
		$name         = $this->sanitize_text( $req->get_param( 'name' ) ?? '' );
		$workspace_id = (int) $req->get_param( 'workspace_id' );
		$team_ids     = $this->sanitize_int_array( $req->get_param( 'team_ids' ) );

		if ( empty( $name ) ) {
			return $this->error( esc_html__( 'Project name is required.', 'softtent-todox' ) );
		}

		if ( empty( $workspace_id ) ) {
			return $this->error( esc_html__( 'Workspace ID is required.', 'softtent-todox' ) );
		}

		if ( empty( $team_ids ) ) {
			return $this->error( esc_html__( 'At least one team is required.', 'softtent-todox' ) );
		}

		$id = Project::create(
            [
				'name'         => $name,
				'workspace_id' => $workspace_id,
				'team_ids'     => $team_ids,
				'owner_id'     => $this->current_user_id(),
				'description'  => $this->sanitize_textarea( $req->get_param( 'description' ) ?? '' ),
				'color'        => $this->sanitize_color( $req->get_param( 'color' ) ),
				'icon'         => $this->sanitize_text( $req->get_param( 'icon' ) ?? '' ),
				'status'       => $req->get_param( 'status' ) ?? 'active',
				'status_id'    => $this->sanitize_int( $req->get_param( 'status_id' ) ),
			]
        );

		return $id
			? $this->ok( Project::get( $id ), esc_html__( 'Project created.', 'softtent-todox' ), 201 )
			: $this->error( esc_html__( 'Failed to create project.', 'softtent-todox' ) );
	}

	public function update( \WP_REST_Request $req ): \WP_REST_Response {
		$id     = (int) $req->get_param( 'id' );
		$params = $req->get_params();

		if ( isset( $params['team_ids'] ) ) {
			$params['team_ids'] = $this->sanitize_int_array( $params['team_ids'] );
		}

		Project::update( $id, $params );

		return $this->ok( Project::get( $id ), esc_html__( 'Project updated.', 'softtent-todox' ) );
	}

	public function destroy( \WP_REST_Request $req ): \WP_REST_Response {
		Project::delete( (int) $req->get_param( 'id' ) );

		return $this->ok( null, esc_html__( 'Project deleted.', 'softtent-todox' ) );
	}

	public function reorder( \WP_REST_Request $req ): \WP_REST_Response {
		$items = $req->get_param( 'items' );

		if ( ! is_array( $items ) || empty( $items ) ) {
			return $this->error( esc_html__( 'Items array is required.', 'softtent-todox' ) );
		}

		Project::reorder( $items );

		return $this->ok( null, esc_html__( 'Projects reordered.', 'softtent-todox' ) );
	}

	/**
	 * Sanitize an array of IDs from request input.
	 */
	private function sanitize_int_array( mixed $value ): array {
		if ( ! is_array( $value ) ) {
			return [];
		}
		return array_values( array_filter( array_map( 'intval', $value ) ) );
	}
}
