<?php

namespace SoftTent\TodoX\Setup;

defined( 'ABSPATH' ) || exit;

/**
 * Seeds default data (task statuses, priorities) on fresh install.
 *
 * @since 0.1.0
 */
class Seeder {

	public function run(): void {
		// Seed default taxonomy entries per workspace on first workspace creation.
		// Global seeds (no workspace context) go here.
	}

	/**
	 * Seed default task statuses for a workspace.
	 *
	 * Called when a workspace is first created.
	 *
	 * @since 0.1.0
	 */
	public static function seed_workspace_defaults( int $workspace_id ): void {
		global $wpdb;

		$table = $wpdb->prefix . 'st_todox_taxonomies';

		$task_statuses = [
			[
				'name' => 'To Do',
				'category' => 'todo',
				'color' => '#94a3b8',
				'icon' => 'circle',
				'position' => 0,
			],
			[
				'name' => 'In Progress',
				'category' => 'in_progress',
				'color' => '#3b82f6',
				'icon' => 'clock',
				'position' => 1,
			],
			[
				'name' => 'In Review',
				'category' => 'review',
				'color' => '#f59e0b',
				'icon' => 'eye',
				'position' => 2,
			],
			[
				'name' => 'Completed',
				'category' => 'completed',
				'color' => '#22c55e',
				'icon' => 'check-circle',
				'position' => 3,
			],
		];

		$sprint_statuses = [
			[
				'name' => 'Planned',
				'color' => '#94a3b8',
				'icon' => 'calendar',
				'position' => 0,
			],
			[
				'name' => 'Active',
				'color' => '#3b82f6',
				'icon' => 'play-circle',
				'position' => 1,
			],
			[
				'name' => 'Completed',
				'color' => '#22c55e',
				'icon' => 'check',
				'position' => 2,
			],
		];

		foreach ( $task_statuses as $status ) {
			$wpdb->insert( // phpcs:ignore
				$table,
				[
					'workspace_id' => $workspace_id,
					'name'         => $status['name'],
					'type'         => 'task_status',
					'category'     => $status['category'],
					'color'        => $status['color'],
					'icon'         => $status['icon'],
					'position'     => $status['position'],
					'is_active'    => 1,
				]
			);
		}

		foreach ( $sprint_statuses as $status ) {
			$wpdb->insert( // phpcs:ignore
				$table,
				[
					'workspace_id' => $workspace_id,
					'name'         => $status['name'],
					'type'         => 'sprint_status',
					'color'        => $status['color'],
					'icon'         => $status['icon'],
					'position'     => $status['position'],
					'is_active'    => 1,
				]
			);
		}
	}
}
