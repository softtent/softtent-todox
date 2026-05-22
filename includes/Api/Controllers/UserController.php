<?php

namespace SoftTent\TodoX\Api\Controllers;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Abstracts\RestApi;

/**
 * REST controller for WordPress users (read-only, for assignment dropdowns).
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
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
			]
        );

		register_rest_route(
            $this->namespace, '/' . $this->base . '/me', [
				[
					'methods' => 'GET',
					'callback' => [ $this, 'me' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
			]
        );
	}

	public function index( \WP_REST_Request $req ): \WP_REST_Response {
		$search   = sanitize_text_field( $req->get_param( 'search' ) ?? '' );
		$per_page = min( 50, (int) ( $req->get_param( 'per_page' ) ?? 20 ) );
		$page     = max( 1, (int) ( $req->get_param( 'page' ) ?? 1 ) );

		$args = [
			'number' => $per_page,
			'offset' => ( $page - 1 ) * $per_page,
			'fields' => [ 'ID', 'display_name', 'user_email' ],
		];

		if ( $search ) {
			$args['search']         = '*' . $search . '*';
			$args['search_columns'] = [ 'display_name', 'user_email' ];
		}

		$query = new \WP_User_Query( $args );
		$total = $query->get_total();
		$users = $query->get_results();

		$items = array_map(
            fn( $u ) => [
				'id'     => $u->ID,
				'name'   => $u->display_name,
				'email'  => $u->user_email,
				'avatar' => get_avatar_url( $u->ID, [ 'size' => 40 ] ),
            ], $users
        );

		return $this->ok(
            [
				'items'   => $items,
				'total'   => $total,
				'page'    => $page,
				'per_page' => $per_page,
			]
        );
	}

	public function me( \WP_REST_Request $req ): \WP_REST_Response {
		return $this->ok( \SoftTent\TodoX\Helpers\Fns::get_current_user_data() );
	}
}
