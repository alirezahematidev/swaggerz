/** The code themes, built from the palette tokens and read by ec.config.mjs. */
import { codeTheme } from '../../src/styles/code-theme.ts';
import { writeGenerated } from './output.ts';

export async function codeThemes(): Promise<void> {
  await writeGenerated('code-themes.json', { dark: codeTheme('dark'), light: codeTheme('light') });
}
