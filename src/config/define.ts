import type { SwaggerzPlugin } from '../plugins/types.ts';
import type { ConfigEnv, UserConfig } from './types.ts';

/**
 * Declares a configuration with full type checking and editor autocomplete.
 *
 * @example
 * ```ts
 * import { defineConfig } from 'swaggerz';
 *
 * export default defineConfig({
 *   spec: { version: '3.1', input: './openapi.yaml' },
 *   output: { directory: './src/generated/api' },
 * });
 * ```
 */
export function defineConfig(config: UserConfig): UserConfig;
export function defineConfig(
  config: (env: ConfigEnv) => UserConfig | Promise<UserConfig>,
): (env: ConfigEnv) => UserConfig | Promise<UserConfig>;
export function defineConfig(
  config: UserConfig | ((env: ConfigEnv) => UserConfig | Promise<UserConfig>),
): UserConfig | ((env: ConfigEnv) => UserConfig | Promise<UserConfig>) {
  return config;
}

/** Declares a plugin with full type checking. */
export function definePlugin(plugin: SwaggerzPlugin): SwaggerzPlugin {
  return plugin;
}
