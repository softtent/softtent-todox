<?php

namespace SoftTent\TodoX\Api\Controllers;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Abstracts\RestApi;
use SoftTent\TodoX\Models\Notification;
use SoftTent\TodoX\Helpers\Fns;

/**
 * REST controller for notifications.
 *
 * @since 0.1.0
 */
class NotificationController extends RestApi {

	protected $base = 'notifications';

	public function routes(): void {
		register_rest_route(
            $this->namespace, '/' . $this->base, [
				[
					'methods' => 'GET',
					'callback' => [ $this, 'index' ],
					'permission_callback' => [ $this, 'is_app_user' ],
				],
			]
        );

		register_rest_route(
            $this->namespace, '/' . $this->base . '/read-all', [
				[
					'methods' => 'POST',
					'callback' => [ $this, 'mark_all_read' ],
					'permission_callback' => [ $this, 'is_app_user' ],
				],
			]
        );

		register_rest_route(
            $this->namespace, '/' . $this->base . '/(?P<id>\d+)/read', [
				[
					'methods' => 'POST',
					'callback' => [ $this, 'mark_read' ],
					'permission_callback' => [ $this, 'is_app_user' ],
				],
			]
        );

		register_rest_route(
            $this->namespace, '/' . $this->base . '/unread-count', [
				[
					'methods' => 'GET',
					'callback' => [ $this, 'unread_count' ],
					'permission_callback' => [ $this, 'is_app_user' ],
				],
			]
        );
	}

	public function index( \WP_REST_Request $req ): \WP_REST_Response {
		$pagination = Fns::get_pagination( $req );

		$items = Notification::get_all(
            $this->current_user_id(), [
				'unread_only' => $req->get_param( 'unread_only' ),
				'per_page'    => $pagination['per_page'],
				'offset'      => $pagination['offset'],
			]
        );

		return $this->ok( $items );
	}

	public function mark_read( \WP_REST_Request $req ): \WP_REST_Response {
		Notification::mark_read( (int) $req->get_param( 'id' ), $this->current_user_id() );

		return $this->ok( null, esc_html__( 'Notification marked as read.', 'softtent-todox' ) );
	}

	public function mark_all_read( \WP_REST_Request $_req ): \WP_REST_Response {
		Notification::mark_all_read( $this->current_user_id() );

		return $this->ok( null, esc_html__( 'All notifications marked as read.', 'softtent-todox' ) );
	}

	public function unread_count( \WP_REST_Request $_req ): \WP_REST_Response {
		return $this->ok( [ 'count' => Notification::unread_count( $this->current_user_id() ) ] );
	}
}
