const defaults = require( '@wordpress/scripts/config/webpack.config' );
const { getWebpackEntryPoints } = require( '@wordpress/scripts/utils/config' );
const I18nLoaderWebpackPlugin = require( '@automattic/i18n-loader-webpack-plugin' );
const path = require( 'path' );

const config = { ...defaults };

if ( 'production' !== process.env.NODE_ENV ) {
	config.devServer = {
		devMiddleware: { writeToDisk: true },
		allowedHosts: 'all',
		host: 'localhost',
		port: 8888,
		proxy: {
			'/build': { pathRewrite: { '^/build': '' } },
		},
	};
}

module.exports = {
	...config,
	entry: {
		...getWebpackEntryPoints(),
		'i18n-loader': './tools/i18n-loader.ts',
		index: './src/index.tsx',
	},
	plugins: [
		...defaults.plugins,
		new I18nLoaderWebpackPlugin( {
			textdomain: 'softtent-todox',
			loaderModule: 'todoxI18nLoader',
		} ),
	],
	resolve: {
		alias: {
			'@todox': path.resolve( __dirname, './src' ),
		},
		extensions: [ '.tsx', '.ts', '.jsx', '.js', '.json' ],
	},
	externals: {
		todoxI18nLoader: [ 'window', 'todoxI18nLoader' ],
	},
};
