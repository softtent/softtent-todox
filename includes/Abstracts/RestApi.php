<?php

namespace SoftTent\TodoX\Abstracts;

defined( 'ABSPATH' ) || exit;

use WP_Error;
use WP_REST_Controller;
use WP_REST_Response;
use SoftTent\TodoX\Helpers\Fns;
use SoftTent\TodoX\Models\Workspace;

/**
 * Base REST API controller.
 *
 * Provides permission helpers, common route patterns, and response formatting.
 *
 * @since 0.1.0
 */
abstract class RestApi extends WP_REST_Controller {

	/**
	 * API namespace.
	 *
	 * @var string
	 */
	protected $namespace = 'todox/v1';

	/**
	 * Endpoint base (override in subclass).
	 *
	 * @var string
	 */
	protected $base = '';

	/**
	 * Register routes — implemented by each controller.
	 */
	abstract public function routes(): void;

	/**
	 * Permission check: user must be able to manage options (admin).
	 *
	 * @since 0.1.0
	 */
	public function is_admin( \WP_REST_Request $req ): bool|WP_Error {
		if ( ! current_user_can( 'manage_options' ) ) {
			return new WP_Error(
				'rest_forbidden',
				esc_html__( 'Sorry, you are not allowed to do that.', 'softtent-todox' ),
				[ 'status' => is_user_logged_in() ? 403 : 401 ]
			);
		}

		return true;
	}

	/**
	 * Permission check: user must be logged in.
	 *
	 * Use this only for endpoints whose only requirement is authentication
	 * (e.g. the workspaces list, which is filtered server-side to the user's
	 * own memberships). For everything that touches workspace data, prefer
	 * is_app_user() or can_access_workspace().
	 *
	 * @since 0.1.0
	 */
	public function is_logged_in( \WP_REST_Request $req ): bool|WP_Error {
		unset( $req );

		if ( ! is_user_logged_in() ) {
			return new WP_Error(
				'rest_not_logged_in',
				esc_html__( 'Authentication required.', 'softtent-todox' ),
				[ 'status' => 401 ]
			);
		}

		return true;
	}

	/**
	 * Permission check: caller is an authorised app user.
	 *
	 * For a task-management app, "logged in" is too weak — every WordPress
	 * subscriber/customer would qualify. We additionally require:
	 *
	 *   1. A configurable WP capability (default `read`, filterable via
	 *      `st_todox_app_capability`). Sites can raise this to `edit_posts`
	 *      or a custom cap to keep low-privileged accounts out.
	 *   2. Membership of at least one workspace, OR `manage_options`. This
	 *      prevents arbitrary logged-in users from probing user-scoped
	 *      endpoints (notifications, /users/me, member lookups) when they
	 *      have never been invited to a workspace.
	 *
	 * @since 0.2.0
	 */
	public function is_app_user( \WP_REST_Request $req ): bool|WP_Error {
		unset( $req );

		if ( ! is_user_logged_in() ) {
			return new WP_Error(
				'rest_not_logged_in',
				esc_html__( 'Authentication required.', 'softtent-todox' ),
				[ 'status' => 401 ]
			);
		}

		$capability = (string) apply_filters( 'st_todox_app_capability', 'read' );

		if ( $capability !== '' && ! current_user_can( $capability ) ) {
			return new WP_Error(
				'rest_forbidden',
				esc_html__( 'You do not have permission to use this app.', 'softtent-todox' ),
				[ 'status' => 403 ]
			);
		}

		if ( current_user_can( 'manage_options' ) ) {
			return true;
		}

		if ( ! Workspace::has_any_membership( get_current_user_id() ) ) {
			return new WP_Error(
				'rest_forbidden',
				esc_html__( 'You are not a member of any workspace.', 'softtent-todox' ),
				[ 'status' => 403 ]
			);
		}

		return true;
	}

	/**
	 * Permission check: user must be a member of the workspace specified in
	 * the request `workspace_id` parameter.
	 *
	 * Unlike the previous behaviour, this denies when workspace_id is missing
	 * — callers must provide a workspace context. Routes that resolve the
	 * workspace from a resource ID should use can_access_workspace() directly.
	 *
	 * @since 0.1.0
	 */
	public function is_workspace_member( \WP_REST_Request $req ): bool|WP_Error {
		$workspace_id = (int) ( $req->get_param( 'workspace_id' ) ?? 0 );

		return $this->can_access_workspace( $workspace_id );
	}

	/**
	 * Permission check: user must be a member of the given workspace.
	 *
	 * Unlike is_workspace_member(), this REQUIRES a workspace ID and denies
	 * by default. Use this from route closures that resolve the workspace
	 * from the target resource (task, comment, etc.) instead of from request
	 * params, so callers cannot bypass the check by omitting workspace_id.
	 *
	 * @since 0.2.0
	 */
	protected function can_access_workspace( int $workspace_id ): bool|WP_Error {
		if ( ! is_user_logged_in() ) {
			return new WP_Error(
				'rest_not_logged_in',
				esc_html__( 'Authentication required.', 'softtent-todox' ),
				[ 'status' => 401 ]
			);
		}

		if ( current_user_can( 'manage_options' ) ) {
			return true;
		}

		if ( $workspace_id <= 0 ) {
			return new WP_Error(
				'rest_forbidden',
				esc_html__( 'Workspace context is required.', 'softtent-todox' ),
				[ 'status' => 403 ]
			);
		}

		if ( ! Workspace::is_member( $workspace_id, get_current_user_id() ) ) {
			return new WP_Error(
				'rest_forbidden',
				esc_html__( 'You are not a member of this workspace.', 'softtent-todox' ),
				[ 'status' => 403 ]
			);
		}

		return true;
	}

	/**
	 * Shorthand to build a success response.
	 *
	 * @since 0.1.0
	 */
	protected function ok( mixed $data, string $message = '', int $status = 200 ): WP_REST_Response {
		return Fns::success( $data, $message, $status );
	}

	/**
	 * Shorthand to build an error response.
	 *
	 * @since 0.1.0
	 */
	protected function error( string|array $errors, int $status = 400 ): WP_REST_Response {
		return Fns::error( $errors, $status );
	}

	/**
	 * Get current user ID (typed).
	 */
	protected function current_user_id(): int {
		return (int) get_current_user_id();
	}
}
