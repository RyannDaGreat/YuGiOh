import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	// The duel engine (../src) lives outside this package; the server bundle
	// imports it relatively, and the WASM core stays external (loaded from node_modules).
	ssr: { external: ['ocgcore-wasm'] },
	server: { fs: { allow: ['..'] } }
});
