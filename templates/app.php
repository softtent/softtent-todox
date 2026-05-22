<?php
defined( 'ABSPATH' ) || exit;
?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title><?php echo esc_html( get_bloginfo( 'name' ) . ' — ' . esc_html__( 'TodoX', 'softtent-todox' ) ); ?></title>
	<?php wp_head(); ?>
</head>
<body class="st-todox">
	<div id="st-todox"></div>
	<?php wp_footer(); ?>
</body>
</html>
