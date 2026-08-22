declare module '*.css';
declare module '*.png';
declare module '*.svg';

interface ImportMetaEnv {
	readonly VITE_OFFLINE_USER?: string;
	readonly VITE_OFFLINE_PASS?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
