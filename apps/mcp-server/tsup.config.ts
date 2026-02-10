import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/stdio.ts'],
  format: ['esm'],
  clean: true,
  external: ['pg'],
  platform: 'node',
  target: 'node20',
  banner: {
    js: "import { createRequire } from 'module';const require = createRequire(import.meta.url);"
  },
  noExternal: [/.*/],  // Bundle all deps except those in external
  esbuildOptions(options) {
    options.mainFields = ['module', 'main']
  }
})
