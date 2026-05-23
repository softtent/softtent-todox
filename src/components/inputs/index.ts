export { default as MultiSelect } from './MultiSelect';
export type { MultiSelectOption } from './MultiSelect';

export { default as ColorPicker } from './ColorPicker';

export { default as IconPicker } from './IconPicker';
export type { IconOption } from './IconPicker';

// Shared color palettes
export const COLORS_ENTITY = [
	'#6366f1', '#3b82f6', '#10b981', '#f59e0b',
	'#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
];

export const COLORS_WORKSPACE = [
	'#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
	'#f97316', '#eab308', '#22c55e', '#14b8a6',
	'#3b82f6', '#06b6d4',
];

export const COLORS_TAXONOMY = [
	'#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
	'#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#eab308',
	'#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
	'#0ea5e9', '#3b82f6', '#64748b',
];

export const ICONS_STATUS: import('./IconPicker').IconOption[] = [
	{ name: 'circle', symbol: '○' },
	{ name: 'half',   symbol: '◐' },
	{ name: 'dot',    symbol: '◉' },
	{ name: 'check',  symbol: '✓' },
	{ name: 'pause',  symbol: '⏸' },
];
