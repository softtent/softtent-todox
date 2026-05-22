// ============================================================
// Global declarations for WordPress externalized scripts
// ============================================================

declare const stTodoxParams: {
	nonce: string;
	restUrl: string;
	adminUrl: string;
	currentUser: {
		id: number;
		name: string;
		email: string;
		avatar: string;
		roles: string[];
	};
	pluginUrl: string;
	version: string;
};

// ---- @wordpress/data ----
// @wordpress/data is externalized via webpack; declare minimal types needed.
declare module '@wordpress/data' {
	type Selector = ( ...args: any[] ) => any;
	type Action    = ( ...args: any[] ) => any;

	interface Store {
		getState: () => any;
		subscribe: ( listener: () => void ) => () => void;
		dispatch: ( action: any ) => any;
	}

	interface StoreDescriptor< Config extends any = any > {
		name: string;
	}

	export function register( store: any ): void;
	export function registerStore( storeName: string, options: any ): Store;
	export function dispatch( storeName: string ): Record< string, Action >;
	export function select( storeName: string ): Record< string, Selector >;
	export function useSelect< T >( mapSelect: ( select: ( storeName: string ) => any ) => T, deps?: any[] ): T;
	export function useDispatch( storeName: string ): Record< string, Action >;
	export function createReduxStore( key: string, options: any ): any;
	export function subscribe( listener: () => void ): () => void;
}

// ---- CSS / SCSS module side-effect imports ----
declare module '*.css'  {}
declare module '*.scss' {}
declare module '*.sass' {}

// ---- Image assets ----
declare module '*.svg'  { const src: string; export default src; }
declare module '*.png'  { const src: string; export default src; }
declare module '*.jpg'  { const src: string; export default src; }
declare module '*.webp' { const src: string; export default src; }
