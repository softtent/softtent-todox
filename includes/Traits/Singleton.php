<?php

namespace SoftTent\TodoX\Traits;

defined( 'ABSPATH' ) || exit;

/**
 * Singleton trait.
 *
 * @since 0.1.0
 */
trait Singleton {

	private static array $instances = [];

	public static function instance(): static {
		$class = static::class;

		if ( ! isset( self::$instances[ $class ] ) ) {
			self::$instances[ $class ] = new static();
		}

		return self::$instances[ $class ];
	}

	private function __clone() {}
}
