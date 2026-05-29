import type { TaskPriority } from '../types';

export function cn( ...classes: ( string | undefined | false | null )[] ): string {
	return classes.filter( Boolean ).join( ' ' );
}

function parseDate( dateStr: string | null | undefined ): Date | null {
	if ( ! dateStr ) return null;
	const d = new Date( dateStr );
	return isNaN( d.getTime() ) ? null : d;
}

export function formatDate( dateStr: string | null | undefined ): string {
	const d = parseDate( dateStr );
	if ( ! d ) return '—';

	return new Intl.DateTimeFormat( navigator.language, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	} ).format( d );
}

export function formatRelativeTime( dateStr: string ): string {
	const d = parseDate( dateStr );
	if ( ! d ) return '—';

	const diff    = Date.now() - d.getTime();
	const seconds = Math.floor( diff / 1000 );

	if ( seconds < 60 ) return 'just now';
	if ( seconds < 3600 ) return `${ Math.floor( seconds / 60 ) }m ago`;
	if ( seconds < 86400 ) return `${ Math.floor( seconds / 3600 ) }h ago`;
	if ( seconds < 604800 ) return `${ Math.floor( seconds / 86400 ) }d ago`;

	return formatDate( dateStr );
}

export function isOverdue( dueDate: string | null | undefined ): boolean {
	const d = parseDate( dueDate );
	if ( ! d ) return false;

	// Compare calendar dates only — a task whose due date is today is NOT overdue,
	// only a task whose due date is strictly before today.
	const today = new Date();
	today.setHours( 0, 0, 0, 0 );
	d.setHours( 0, 0, 0, 0 );

	return d.getTime() < today.getTime();
}

export function priorityColor( priority: TaskPriority ): string {
	switch ( priority ) {
		case 'urgent': return '#ef4444';
		case 'high':   return '#f97316';
		case 'medium': return '#f59e0b';
		case 'low':    return '#22c55e';
	}
}

export function statusColor( status: string ): string {
	switch ( status ) {
		case 'todo':        return '#94a3b8';
		case 'in_progress': return '#3b82f6';
		case 'review':      return '#f59e0b';
		case 'completed':   return '#22c55e';
		default:            return '#6366f1';
	}
}

export function statusLabel( status: string ): string {
	switch ( status ) {
		case 'todo':        return 'To Do';
		case 'in_progress': return 'In Progress';
		case 'review':      return 'In Review';
		case 'completed':   return 'Completed';
		default:
			return status.replace( /_/g, ' ' ).replace( /\b\w/g, ( c ) => c.toUpperCase() );
	}
}

export function priorityLabel( priority: TaskPriority ): string {
	return priority.charAt( 0 ).toUpperCase() + priority.slice( 1 );
}

export function truncate( str: string, maxLength: number ): string {
	return str.length > maxLength ? str.slice( 0, maxLength ) + '…' : str;
}

export function getInitials( name: string ): string {
	if ( ! name ) return '?';
	return name
		.split( ' ' )
		.slice( 0, 2 )
		.map( ( w ) => w[ 0 ]?.toUpperCase() ?? '' )
		.join( '' );
}
