import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Linked workspace packages resolve their own react install; dedupe keeps
  // every component on this workspace's single React instance.
  resolve: { dedupe: ['react', 'react-dom'] },
  test: {
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
    environment: 'node',
    server: {
      deps: {
        // Registry-installed @deepseek-ai/dsh-* packages ship a built lib/ that
        // imports CSS modules; externalized, Node cannot load the .css files.
        // Inlining makes vitest transform them like the monorepo linked source.
        inline: [/@deepseek-ai\/dsh-/],
      },
    },
  },
})
