<?php

namespace SoftTent\TodoX\Traits;

defined( 'ABSPATH' ) || exit;

/**
 * Sanitizer trait for REST controllers.
 *
 * @since 0.1.0
 */
trait Sanitizer {

	/**
	 * Sanitize a text field.
	 */
	protected function sanitize_text( mixed $value ): string {
		return sanitize_text_field( wp_unslash( (string) $value ) );
	}

	/**
	 * Sanitize a textarea/rich text field.
	 */
	protected function sanitize_textarea( mixed $value ): string {
		return wp_kses_post( wp_unslash( (string) $value ) );
	}

	/**
	 * Sanitize an integer.
	 */
	protected function sanitize_int( mixed $value ): int {
		return (int) $value;
	}

	/**
	 * Sanitize an enum value against allowed values.
	 *
	 * @param array<string> $allowed
	 */
	protected function sanitize_enum( mixed $value, array $allowed, string $fallback = '' ): string {
		$value = sanitize_text_field( (string) $value );

		return in_array( $value, $allowed, true ) ? $value : $fallback;
	}

	/**
	 * Sanitize a date string (Y-m-d format).
	 */
	protected function sanitize_date( mixed $value ): ?string {
		if ( ! $value ) {
			return null;
		}

		$date = \DateTime::createFromFormat( 'Y-m-d', (string) $value );

		return $date ? $date->format( 'Y-m-d' ) : null;
	}

	/**
	 * Sanitize a color hex value.
	 */
	protected function sanitize_color( mixed $value ): string {
		return \SoftTent\TodoX\Helpers\Fns::sanitize_color( (string) $value );
	}

	/**
	 * Sanitize a boolean.
	 */
	protected function sanitize_bool( mixed $value ): bool {
		return filter_var( $value, FILTER_VALIDATE_BOOLEAN );
	}

	/**
	 * Sanitize an email.
	 */
	protected function sanitize_email_field( mixed $value ): string {
		return sanitize_email( (string) $value );
	}
}
