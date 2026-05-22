<?php

namespace SoftTent\TodoX\Hooks;

defined( 'ABSPATH' ) || exit;

use SoftTent\TodoX\Frontend\App;

/**
 * Hooks manager — wires up WordPress action/filter hooks.
 *
 * @since 0.1.0
 */
class Manager {

	public function __construct() {
		add_filter( 'plugin_action_links_' . plugin_basename( \ST_TODOX_FILE ), [ $this, 'plugin_action_links' ] );
	}

	/**
	 * Add "Manage TodoX" link on the plugins list page.
	 *
	 * @since 0.1.0
	 *
	 * @param array<string> $links
	 * @return array<string>
	 */
	public function plugin_action_links( array $links ): array {
		$app_link = sprintf(
			'<a href="%s">%s</a>',
			esc_url( App::get_page_url() ),
			esc_html__( 'Manage TodoX', 'softtent-todox' )
		);

		array_unshift( $links, $app_link );

		return $links;
	}
}
