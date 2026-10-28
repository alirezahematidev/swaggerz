/**
 * The oldest supported versions that `scripts/compat.ts` installs side by side (package aliases
 * for the TypeScript compilers). In a module of its own so the docs website can check
 * docs/compatibility.md against it without running the installation.
 */
export const DEPENDENCIES: Record<string, string> = {
  'ts-5.0': 'npm:typescript@5.0.4',
  'ts-5.4': 'npm:typescript@5.4.5',
  'ts-6': 'npm:typescript@~6.0.3',
  'ts-7': 'npm:typescript@^7.0.2',
  '@tanstack/react-query': '5.0.0',
  react: '^19.2.0',
  '@types/react': '^19.2.0',
  '@tanstack/vue-query': '5.0.0',
  vue: '3.3.4',
  '@tanstack/svelte-query': '6.0.0',
  svelte: '5.25.0',
  '@tanstack/solid-query': '5.0.0',
  'solid-js': '1.8.0',
  swr: '2.2.0',
  axios: '1.0.0',
  zod: '4.0.15',
  valibot: '1.0.0',
  arktype: '2.0.0',
  msw: '2.11.0',
  // Not a dependency of generated code: the oldest Vite that `swaggerz/vite` runs in.
  vite: '6.0.0',
};
