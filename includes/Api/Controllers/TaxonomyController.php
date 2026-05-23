<?php

namespace SoftTent\TodoX\Api\Controllers;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Abstracts\RestApi;
use SoftTent\TodoX\Models\Taxonomy;
use SoftTent\TodoX\Traits\Sanitizer;

/**
 * REST controller for taxonomies (statuses, labels).
 *
 * @since 0.1.0
 */
class TaxonomyController extends RestApi {

	use Sanitizer;

	protected $base = 'taxonomies';

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
            $this->namespace, '/' . $this->base . '/reorder', [
				[
					'methods' => 'POST',
					'callback' => [ $this, 'reorder' ],
					'permission_callback' => [ $this, 'is_workspace_member' ],
				],
			]
        );

		register_rest_route(
            $this->namespace, '/' . $this->base . '/(?P<id>\d+)', [
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

		return $this->ok( Taxonomy::get_all( $workspace_id, $req->get_param( 'type' ) ) );
	}

	/** Allowed taxonomy types. */
	private const ALLOWED_TYPES = [ 'task_status', 'sprint_status', 'project_status', 'subtask_status', 'task_label', 'subtask_label', 'project_label' ];

	public function store( \WP_REST_Request $req ): \WP_REST_Response {
		$name = $this->sanitize_text( $req->get_param( 'name' ) ?? '' );

		if ( empty( $name ) ) {
			return $this->error( esc_html__( 'Taxonomy name is required.', 'softtent-todox' ) );
		}

		$type = $this->sanitize_text( $req->get_param( 'type' ) ?? '' );

		if ( ! in_array( $type, self::ALLOWED_TYPES, true ) ) {
			return $this->error( esc_html__( 'Invalid taxonomy type.', 'softtent-todox' ) );
		}

		$is_global    = (bool) $req->get_param( 'is_global' );
		$workspace_id = null;

		if ( ! $is_global ) {
			$workspace_id = (int) $req->get_param( 'workspace_id' );
			if ( ! $workspace_id ) {
				return $this->error( esc_html__( 'workspace_id is required for workspace-scoped taxonomies.', 'softtent-todox' ) );
			}
		}

		$id = Taxonomy::create(
            [
				'name'         => $name,
				'type'         => $type,
				'is_global'    => $is_global,
				'workspace_id' => $is_global ? null : $workspace_id,
				'color'        => $req->get_param( 'color' ) ?? '#6366f1',
				'icon'         => $req->get_param( 'icon' ) ?? null,
				'slug'         => $req->get_param( 'slug' ) ?? '',
			]
        );

		return $id
			? $this->ok( Taxonomy::get( $id ), esc_html__( 'Taxonomy created.', 'softtent-todox' ), 201 )
			: $this->error( esc_html__( 'Failed to create taxonomy.', 'softtent-todox' ) );
	}

	public function update( \WP_REST_Request $req ): \WP_REST_Response {
		$id = (int) $req->get_param( 'id' );

		Taxonomy::update( $id, $req->get_params() );

		return $this->ok( Taxonomy::get( $id ), esc_html__( 'Taxonomy updated.', 'softtent-todox' ) );
	}

	public function destroy( \WP_REST_Request $req ): \WP_REST_Response {
		Taxonomy::delete( (int) $req->get_param( 'id' ) );

		return $this->ok( null, esc_html__( 'Taxonomy deleted.', 'softtent-todox' ) );
	}

	public function reorder( \WP_REST_Request $req ): \WP_REST_Response {
		$items = $req->get_param( 'items' );

		if ( ! is_array( $items ) ) {
			return $this->error( esc_html__( 'items must be an array.', 'softtent-todox' ) );
		}

		Taxonomy::reorder( $items );

		return $this->ok( null, esc_html__( 'Taxonomies reordered.', 'softtent-todox' ) );
	}
}
