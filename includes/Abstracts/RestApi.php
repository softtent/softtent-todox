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
	 * Permission check: user must be a workspace member.
	 *
	 * Reads workspace_id from route param or request body.
	 *
	 * @since 0.1.0
	 */
	public function is_workspace_member( \WP_REST_Request $req ): bool|WP_Error {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'rest_not_logged_in', esc_html__( 'Authentication required.', 'softtent-todox' ), [ 'status' => 401 ] );
		}

		if ( current_user_can( 'manage_options' ) ) {
			return true;
		}

		$workspace_id = (int) ( $req->get_param( 'workspace_id' ) ?? 0 );

		if ( ! $workspace_id ) {
			return true;
		}

		if ( ! Workspace::is_member( $workspace_id, get_current_user_id() ) ) {
			return new WP_Error( 'rest_forbidden', esc_html__( 'You are not a member of this workspace.', 'softtent-todox' ), [ 'status' => 403 ] );
		}

		return true;
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
