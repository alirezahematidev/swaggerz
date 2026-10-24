/** The files scripts/playground.ts embeds into the browser compiler, by path suffix. */
declare module 'virtual:embedded-files' {
  export const files: Readonly<Record<string, string>>;
}
