<?php

namespace SoftTent\TodoX\Setup;

defined( 'ABSPATH' ) || exit;

/**
 * Seeds default global taxonomy data on fresh install / upgrade.
 *
 * All defaults use workspace_id = NULL so they appear in every workspace.
 *
 * @since 0.1.0
 */
class Seeder {

	public function run(): void {
		$this->seed_global_defaults();
	}

	/**
	 * Insert global default statuses once.
	 * Skips any type that already has at least one global (workspace_id IS NULL) row.
	 *
	 * @since 0.1.0
	 */
	private function seed_global_defaults(): void {
		global $wpdb;

		$table = $wpdb->prefix . 'st_todox_taxonomies';

		$defaults = [
			'task_status' => [
				[
					'name' => 'To Do',
					'slug'    => 'todo',
					'color' => '#94a3b8',
					'icon' => 'circle',
					'position' => 0,
				],
				[
					'name' => 'In Progress',
					'slug'    => 'in_progress',
					'color' => '#3b82f6',
					'icon' => 'clock',
					'position' => 1,
				],
				[
					'name' => 'In Review',
					'slug'    => 'review',
					'color' => '#f59e0b',
					'icon' => 'eye',
					'position' => 2,
				],
				[
					'name' => 'Completed',
					'slug'    => 'completed',
					'color' => '#22c55e',
					'icon' => 'check-circle',
					'position' => 3,
				],
			],
			'subtask_status' => [
				[
					'name' => 'To Do',
					'slug'    => 'todo',
					'color' => '#94a3b8',
					'icon' => 'circle',
					'position' => 0,
				],
				[
					'name' => 'In Progress',
					'slug'    => 'in_progress',
					'color' => '#3b82f6',
					'icon' => 'clock',
					'position' => 1,
				],
				[
					'name' => 'Done',
					'slug'    => 'done',
					'color' => '#22c55e',
					'icon' => 'check-circle',
					'position' => 2,
				],
			],
			'sprint_status' => [
				[
					'name' => 'Planned',
					'slug'    => 'planned',
					'color' => '#94a3b8',
					'icon' => 'calendar',
					'position' => 0,
				],
				[
					'name' => 'Active',
					'slug'    => 'active',
					'color' => '#3b82f6',
					'icon' => 'play-circle',
					'position' => 1,
				],
				[
					'name' => 'Completed',
					'slug'    => 'completed',
					'color' => '#22c55e',
					'icon' => 'check',
					'position' => 2,
				],
			],
			'project_status' => [
				[
					'name' => 'Active',
					'slug'    => 'active',
					'color' => '#3b82f6',
					'icon' => 'play-circle',
					'position' => 0,
				],
				[
					'name' => 'Completed',
					'slug'    => 'completed',
					'color' => '#22c55e',
					'icon' => 'check-circle',
					'position' => 1,
				],
				[
					'name' => 'Archived',
					'slug'    => 'archived',
					'color' => '#94a3b8',
					'icon' => 'archive',
					'position' => 2,
				],
			],
			'task_label' => [
				[
					'name'     => 'Bug',
					'slug'     => 'bug',
					'color'    => '#ef4444',
					'icon'     => 'bug',
					'position' => 0,
				],
				[
					'name'     => 'Feature',
					'slug'     => 'feature',
					'color'    => '#8b5cf6',
					'icon'     => 'star',
					'position' => 1,
				],
				[
					'name'     => 'Enhancement',
					'slug'     => 'enhancement',
					'color'    => '#06b6d4',
					'icon'     => 'trending-up',
					'position' => 2,
				],
				[
					'name'     => 'Documentation',
					'slug'     => 'documentation',
					'color'    => '#64748b',
					'icon'     => 'file-text',
					'position' => 3,
				],
			],
			'subtask_label' => [
				[
					'name'     => 'Bug',
					'slug'     => 'bug',
					'color'    => '#ef4444',
					'icon'     => 'bug',
					'position' => 0,
				],
				[
					'name'     => 'Feature',
					'slug'     => 'feature',
					'color'    => '#8b5cf6',
					'icon'     => 'star',
					'position' => 1,
				],
				[
					'name'     => 'Enhancement',
					'slug'     => 'enhancement',
					'color'    => '#06b6d4',
					'icon'     => 'trending-up',
					'position' => 2,
				],
				[
					'name'     => 'Documentation',
					'slug'     => 'documentation',
					'color'    => '#64748b',
					'icon'     => 'file-text',
					'position' => 3,
				],
			],
			'project_label' => [
				[
					'name'     => 'Frontend',
					'slug'     => 'frontend',
					'color'    => '#3b82f6',
					'icon'     => 'monitor',
					'position' => 0,
				],
				[
					'name'     => 'Backend',
					'slug'     => 'backend',
					'color'    => '#22c55e',
					'icon'     => 'server',
					'position' => 1,
				],
				[
					'name'     => 'Mobile',
					'slug'     => 'mobile',
					'color'    => '#8b5cf6',
					'icon'     => 'smartphone',
					'position' => 2,
				],
				[
					'name'     => 'Design',
					'slug'     => 'design',
					'color'    => '#ec4899',
					'icon'     => 'pen-tool',
					'position' => 3,
				],
				[
					'name'     => 'DevOps',
					'slug'     => 'devops',
					'color'    => '#f97316',
					'icon'     => 'settings',
					'position' => 4,
				],
				[
					'name'     => 'Research',
					'slug'     => 'research',
					'color'    => '#06b6d4',
					'icon'     => 'search',
					'position' => 5,
				],
			],
		];

		foreach ( $defaults as $type => $statuses ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$exists = (int) $wpdb->get_var(
				$wpdb->prepare(
					'SELECT COUNT(*) FROM %i WHERE workspace_id IS NULL AND type = %s',
					$table,
					$type
				)
			);

			if ( $exists > 0 ) {
				continue;
			}

			foreach ( $statuses as $status ) {
				$wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
					$table,
					[
						'workspace_id' => null,
						'name'         => $status['name'],
						'slug'         => $status['slug'],
						'type'         => $type,
						'color'        => $status['color'],
						'icon'         => $status['icon'],
						'position'     => $status['position'],
						'is_active'    => 1,
					]
				);
			}
		}
	}

	/**
	 * No-op kept for backward compatibility — defaults are now global.
	 *
	 * @since 0.1.0
	 */
	public static function seed_workspace_defaults( int $workspace_id ): void {
		// Global defaults (workspace_id = NULL) cover every workspace automatically.
	}
}
