<?php

namespace SoftTent\TodoX\Api\Controllers;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Abstracts\RestApi;
use SoftTent\TodoX\Models\Team;
use SoftTent\TodoX\Traits\Sanitizer;

/**
 * REST controller for teams.
 *
 * @since 0.1.0
 */
class TeamController extends RestApi {

	use Sanitizer;

	protected $base = 'teams';

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

		register_rest_route(
            $this->namespace, '/' . $this->base . '/(?P<id>\d+)/members', [
				[
					'methods' => 'GET',
					'callback' => [ $this, 'members' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
				[
					'methods' => 'POST',
					'callback' => [ $this, 'add_member' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
			]
        );

		register_rest_route(
            $this->namespace, '/' . $this->base . '/(?P<id>\d+)/members/(?P<user_id>\d+)', [
				[
					'methods' => 'DELETE',
					'callback' => [ $this, 'remove_member' ],
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
            Team::get_all(
                $workspace_id, [
					'department_id' => $req->get_param( 'department_id' ),
					'search'        => $req->get_param( 'search' ) ?? '',
				]
            )
        );
	}

	public function show( \WP_REST_Request $req ): \WP_REST_Response {
		$team = Team::get( (int) $req->get_param( 'id' ) );

		if ( ! $team ) {
			return $this->error( esc_html__( 'Team not found.', 'softtent-todox' ), 404 );
		}

		$team['members'] = Team::get_members( $team['id'] );

		return $this->ok( $team );
	}

	public function store( \WP_REST_Request $req ): \WP_REST_Response {
		$name = $this->sanitize_text( $req->get_param( 'name' ) ?? '' );

		if ( empty( $name ) ) {
			return $this->error( esc_html__( 'Team name is required.', 'softtent-todox' ) );
		}

		$id = Team::create( array_merge( $req->get_params(), [ 'name' => $name ] ) );

		return $id
			? $this->ok( Team::get( $id ), esc_html__( 'Team created.', 'softtent-todox' ), 201 )
			: $this->error( esc_html__( 'Failed to create team.', 'softtent-todox' ) );
	}

	public function update( \WP_REST_Request $req ): \WP_REST_Response {
		$id = (int) $req->get_param( 'id' );

		Team::update( $id, $req->get_params() );

		return $this->ok( Team::get( $id ), esc_html__( 'Team updated.', 'softtent-todox' ) );
	}

	public function destroy( \WP_REST_Request $req ): \WP_REST_Response {
		Team::delete( (int) $req->get_param( 'id' ) );

		return $this->ok( null, esc_html__( 'Team deleted.', 'softtent-todox' ) );
	}

	public function members( \WP_REST_Request $req ): \WP_REST_Response {
		return $this->ok( Team::get_members( (int) $req->get_param( 'id' ) ) );
	}

	public function add_member( \WP_REST_Request $req ): \WP_REST_Response {
		$id      = (int) $req->get_param( 'id' );
		$user_id = (int) ( $req->get_param( 'user_id' ) ?? 0 );
		$role    = $req->get_param( 'role' ) ?? 'member';

		if ( ! get_userdata( $user_id ) ) {
			return $this->error( esc_html__( 'User not found.', 'softtent-todox' ), 404 );
		}

		Team::add_member( $id, $user_id, $role );

		return $this->ok( Team::get_members( $id ), esc_html__( 'Member added.', 'softtent-todox' ) );
	}

	public function remove_member( \WP_REST_Request $req ): \WP_REST_Response {
		Team::remove_member( (int) $req->get_param( 'id' ), (int) $req->get_param( 'user_id' ) );

		return $this->ok( null, esc_html__( 'Member removed.', 'softtent-todox' ) );
	}
}
