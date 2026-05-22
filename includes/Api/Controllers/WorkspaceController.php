<?php

namespace SoftTent\TodoX\Api\Controllers;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Abstracts\RestApi;
use SoftTent\TodoX\Models\Workspace;
use SoftTent\TodoX\Traits\Sanitizer;

/**
 * REST controller for workspaces.
 *
 * Routes:
 *   GET    /todox/v1/workspaces
 *   POST   /todox/v1/workspaces
 *   GET    /todox/v1/workspaces/:id
 *   PUT    /todox/v1/workspaces/:id
 *   DELETE /todox/v1/workspaces/:id
 *   GET    /todox/v1/workspaces/:id/members
 *   POST   /todox/v1/workspaces/:id/members
 *   DELETE /todox/v1/workspaces/:id/members/:user_id
 *
 * @since 0.1.0
 */
class WorkspaceController extends RestApi {

	use Sanitizer;

	protected $base = 'workspaces';

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
            $this->namespace, '/' . $this->base . '/(?P<id>\d+)/members', [
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'members' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'add_member' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
			]
        );

		register_rest_route(
            $this->namespace, '/' . $this->base . '/(?P<id>\d+)/members/(?P<user_id>\d+)', [
				[
					'methods'             => 'DELETE',
					'callback'            => [ $this, 'remove_member' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
			]
        );
	}

	public function index( \WP_REST_Request $req ): \WP_REST_Response {
		$items = Workspace::get_all(
            $this->current_user_id(), [
				'search' => $req->get_param( 'search' ) ?? '',
			]
        );

		return $this->ok( $items );
	}

	public function show( \WP_REST_Request $req ): \WP_REST_Response {
		$id        = (int) $req->get_param( 'id' );
		$workspace = Workspace::get( $id );

		if ( ! $workspace ) {
			return $this->error( esc_html__( 'Workspace not found.', 'softtent-todox' ), 404 );
		}

		if ( ! $this->can_access( $id ) ) {
			return $this->error( esc_html__( 'Access denied.', 'softtent-todox' ), 403 );
		}

		$workspace['members_count'] = Workspace::count_members( $id );
		$workspace['owner']         = \SoftTent\TodoX\Helpers\Fns::get_user_info( $workspace['owner_id'] );

		return $this->ok( $workspace );
	}

	public function store( \WP_REST_Request $req ): \WP_REST_Response {
		$name = $this->sanitize_text( $req->get_param( 'name' ) ?? '' );

		if ( empty( $name ) ) {
			return $this->error( esc_html__( 'Workspace name is required.', 'softtent-todox' ) );
		}

		$id = Workspace::create(
            [
				'name'        => $name,
				'description' => $req->get_param( 'description' ) ?? '',
				'color'       => $req->get_param( 'color' ) ?? '#6366f1',
				'is_public'   => $req->get_param( 'is_public' ) ?? false,
				'owner_id'    => $this->current_user_id(),
			]
        );

		if ( ! $id ) {
			return $this->error( esc_html__( 'Failed to create workspace.', 'softtent-todox' ) );
		}

		return $this->ok( Workspace::get( $id ), esc_html__( 'Workspace created.', 'softtent-todox' ), 201 );
	}

	public function update( \WP_REST_Request $req ): \WP_REST_Response {
		$id = (int) $req->get_param( 'id' );

		if ( ! $this->can_manage( $id ) ) {
			return $this->error( esc_html__( 'Access denied.', 'softtent-todox' ), 403 );
		}

		Workspace::update( $id, $req->get_params() );

		return $this->ok( Workspace::get( $id ), esc_html__( 'Workspace updated.', 'softtent-todox' ) );
	}

	public function destroy( \WP_REST_Request $req ): \WP_REST_Response {
		$id        = (int) $req->get_param( 'id' );
		$workspace = Workspace::get( $id );

		if ( ! $workspace ) {
			return $this->error( esc_html__( 'Workspace not found.', 'softtent-todox' ), 404 );
		}

		if ( $workspace['owner_id'] !== $this->current_user_id() && ! current_user_can( 'manage_options' ) ) {
			return $this->error( esc_html__( 'Only the workspace owner can delete it.', 'softtent-todox' ), 403 );
		}

		Workspace::delete( $id );

		return $this->ok( null, esc_html__( 'Workspace deleted.', 'softtent-todox' ) );
	}

	public function members( \WP_REST_Request $req ): \WP_REST_Response {
		$id = (int) $req->get_param( 'id' );

		if ( ! $this->can_access( $id ) ) {
			return $this->error( esc_html__( 'Access denied.', 'softtent-todox' ), 403 );
		}

		return $this->ok( Workspace::get_members( $id ) );
	}

	public function add_member( \WP_REST_Request $req ): \WP_REST_Response {
		$id      = (int) $req->get_param( 'id' );
		$user_id = (int) ( $req->get_param( 'user_id' ) ?? 0 );
		$role    = $req->get_param( 'role' ) ?? 'member';

		if ( ! $this->can_manage( $id ) ) {
			return $this->error( esc_html__( 'Access denied.', 'softtent-todox' ), 403 );
		}

		if ( ! get_userdata( $user_id ) ) {
			return $this->error( esc_html__( 'User not found.', 'softtent-todox' ), 404 );
		}

		Workspace::add_member( $id, $user_id, $role );

		return $this->ok( Workspace::get_members( $id ), esc_html__( 'Member added.', 'softtent-todox' ) );
	}

	public function remove_member( \WP_REST_Request $req ): \WP_REST_Response {
		$id      = (int) $req->get_param( 'id' );
		$user_id = (int) $req->get_param( 'user_id' );

		if ( ! $this->can_manage( $id ) ) {
			return $this->error( esc_html__( 'Access denied.', 'softtent-todox' ), 403 );
		}

		Workspace::remove_member( $id, $user_id );

		return $this->ok( null, esc_html__( 'Member removed.', 'softtent-todox' ) );
	}

	private function can_access( int $workspace_id ): bool {
		if ( current_user_can( 'manage_options' ) ) {
			return true;
        }

		return Workspace::is_member( $workspace_id, $this->current_user_id() );
	}

	private function can_manage( int $workspace_id ): bool {
		if ( current_user_can( 'manage_options' ) ) {
			return true;
        }

		$role = Workspace::get_member_role( $workspace_id, $this->current_user_id() );

		return in_array( $role, [ 'owner', 'admin' ], true );
	}
}
