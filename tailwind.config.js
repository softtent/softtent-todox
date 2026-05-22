/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: [ 'class' ],
	content: [ './src/**/*.{ts,tsx}', './templates/**/*.php' ],
	prefix: 'st-todox-',
	corePlugins: {
		preflight: false,
	},
	theme: {
		extend: {
			colors: {
				primary: {
					DEFAULT: 'var(--st-todox-primary)',
					dark:    'var(--st-todox-primary-dark)',
					faint:   'var(--st-todox-primary-faint)',
					soft:    'var(--st-todox-primary-soft)',
				},
				background: 'var(--st-todox-bg)',
				surface:    'var(--st-todox-surface)',
				border:     'var(--st-todox-border)',
				foreground: 'var(--st-todox-text)',
				muted:      'var(--st-todox-text-muted)',
				secondary:  'var(--st-todox-text-secondary)',
			},
			fontFamily: {
				sans: [ '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif' ],
			},
		},
	},
	plugins: [],
};
