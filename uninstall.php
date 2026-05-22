<?php
/**
 * Uninstall TodoX
 *
 * @package TodoX
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

if ( ! file_exists( __DIR__ . '/vendor/autoload.php' ) ) {
	return;
}

require_once __DIR__ . '/vendor/autoload.php';

( new SoftTent\TodoX\Setup\Uninstaller() )->run();
