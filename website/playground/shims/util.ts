/** `node:util` for the browser compiler: no terminal, so no colors. */
export function styleText(_format: unknown, text: string): string {
  return text;
}
