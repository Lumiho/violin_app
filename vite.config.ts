import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		globals: true,
		environment: 'jsdom'
	},
	root: '.',
	publicDir: 'public',
	build: {
	outDir: 'dist',
	},
	server: {
	open: true,  // auto-open browser
	},
})
