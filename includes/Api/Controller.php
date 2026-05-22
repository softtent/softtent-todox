<?php

namespace SoftTent\TodoX\Api;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Api\Controllers\{
	WorkspaceController,
	DepartmentController,
	TeamController,
	ProjectController,
	SprintController,
	TaskController,
	SubtaskController,
	TaxonomyController,
	NotificationController,
	UserController,
	SettingsController,
	DashboardController
};

/**
 * REST API controller registry.
 *
 * Instantiates and registers all REST route controllers.
 *
 * @since 0.1.0
 */
class Controller {

	/**
	 * @var array<string, \SoftTent\TodoX\Abstracts\RestApi>
	 */
	protected array $controllers = [];

	/**
	 * Controller map — filterable so add-ons can inject their own controllers.
	 *
	 * @var array<class-string>
	 */
	protected array $class_map = [];

	public function __construct() {
		if ( ! class_exists( 'WP_REST_Server' ) ) {
			return;
		}

		$this->class_map = apply_filters(
			'st_todox_rest_api_class_map',
			[
				WorkspaceController::class,
				DepartmentController::class,
				TeamController::class,
				ProjectController::class,
				SprintController::class,
				TaskController::class,
				SubtaskController::class,
				TaxonomyController::class,
				NotificationController::class,
				UserController::class,
				SettingsController::class,
				DashboardController::class,
			]
		);

		add_action( 'rest_api_init', [ $this, 'register_rest_routes' ], 10 );
	}

	/**
	 * Instantiate each controller and call routes().
	 *
	 * @since 0.1.0
	 */
	public function register_rest_routes(): void {
		foreach ( $this->class_map as $class_name ) {
			$instance = new $class_name();

			if ( method_exists( $instance, 'routes' ) ) {
				$instance->routes();
			}

			$this->controllers[ $class_name ] = $instance;
		}
	}

	/**
	 * Retrieve a controller instance by class name.
	 *
	 * @since 0.1.0
	 */
	public function get_controller( string $class_name ): ?object {
		return $this->controllers[ $class_name ] ?? null;
	}
}
