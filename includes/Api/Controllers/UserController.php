<?php

namespace SoftTent\TodoX\Api\Controllers;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Abstracts\RestApi;
use SoftTent\TodoX\Models\Workspace;

/**
 * REST controller for WordPress users (read-only, for assignment dropdowns).
 *
 * The list endpoint is intentionally scoped to a workspace's members rather
 * than the full WP user table, so subscribers / customers on the site cannot
 * be enumerated by anyone with an app account.
 *
 * @since 0.1.0
 */
class UserController extends RestApi {

	protected $base = 'users';

	public function routes(): void {
		register_rest_route(
            $this->namespace, '/' . $this->base, [
				[
					'methods' => 'GET',
					'callback' => [ $this, 'index' ],
					'permission_callback' => [ $this, 'permissions_index' ],
				],
			]
        );

		register_rest_route(
            $this->namespace, '/' . $this->base . '/me', [
				[
					'methods' => 'GET',
					'callback' => [ $this, 'me' ],
					'permission_callback' => [ $this, 'is_app_user' ],
				],
			]
        );
	}

	/**
	 * Permission check for /users.
	 *
	 * Two valid modes:
	 *   - With workspace_id: caller must be a member of that workspace; the
	 *     handler returns just that workspace's members.
	 *   - Without workspace_id: caller must have `list_users` (typically
	 *     admins). The handler returns the full WP user table for invite UI.
	 *
	 * This prevents subscribers/customers from enumerating every WP account.
	 */
	public function permissions_index( \WP_REST_Request $req ): bool|\WP_Error {
		if ( ! is_user_logged_in() ) {
			return new \WP_Error(
				'rest_not_logged_in',
				esc_html__( 'Authentication required.', 'softtent-todox' ),
				[ 'status' => 401 ]
			);
		}

		$workspace_id = (int) ( $req->get_param( 'workspace_id' ) ?? 0 );

		if ( $workspace_id > 0 ) {
			return $this->can_access_workspace( $workspace_id );
		}

		if ( ! current_user_can( 'list_users' ) ) {
			return new \WP_Error(
				'rest_forbidden',
				esc_html__( 'You are not allowed to list users without a workspace context.', 'softtent-todox' ),
				[ 'status' => 403 ]
			);
		}

		return true;
	}

	public function index( \WP_REST_Request $req ): \WP_REST_Response {
		$workspace_id = (int) ( $req->get_param( 'workspace_id' ) ?? 0 );
		$search       = strtolower( sanitize_text_field( $req->get_param( 'search' ) ?? '' ) );
		$per_page     = min( 50, max( 1, (int) ( $req->get_param( 'per_page' ) ?? 20 ) ) );
		$page         = max( 1, (int) ( $req->get_param( 'page' ) ?? 1 ) );

		if ( $workspace_id > 0 ) {
			$members = Workspace::get_members( $workspace_id );

			if ( $search !== '' ) {
				$members = array_values(
					array_filter(
						$members,
						static function ( $m ) use ( $search ) {
							return str_contains( strtolower( (string) ( $m['name'] ?? '' ) ), $search )
								|| str_contains( strtolower( (string) ( $m['email'] ?? '' ) ), $search );
						}
					)
				);
			}

			$total  = count( $members );
			$offset = ( $page - 1 ) * $per_page;
			$items  = array_slice( $members, $offset, $per_page );

			return $this->ok(
				[
					'items'    => $items,
					'total'    => $total,
					'page'     => $page,
					'per_page' => $per_page,
				]
			);
		}

		// Admin-only fallback: full WP user list for invite pickers.
		$args = [
			'number' => $per_page,
			'offset' => ( $page - 1 ) * $per_page,
			'fields' => [ 'ID', 'display_name', 'user_email' ],
		];

		if ( $search !== '' ) {
			$args['search']         = '*' . $search . '*';
			$args['search_columns'] = [ 'display_name', 'user_email' ];
		}

		$query = new \WP_User_Query( $args );
		$users = $query->get_results();

		$items = array_map(
			static fn( $u ) => [
				'id'     => (int) $u->ID,
				'name'   => $u->display_name,
				'email'  => $u->user_email,
				'avatar' => get_avatar_url( (int) $u->ID, [ 'size' => 40 ] ),
			],
			$users
		);

		return $this->ok(
			[
				'items'    => $items,
				'total'    => (int) $query->get_total(),
				'page'     => $page,
				'per_page' => $per_page,
			]
		);
	}

	public function me( \WP_REST_Request $_req ): \WP_REST_Response {
		return $this->ok( \SoftTent\TodoX\Helpers\Fns::get_current_user_data() );
	}
}
