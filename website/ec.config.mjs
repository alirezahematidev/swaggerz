// @ts-check
/**
 * Expressive Code (code blocks): the themes built from the palette and a plugin that makes scrolling
 * code blocks focusable. In a file of its own because the options contain functions, which the
 * `<Code>` component cannot read from astro.config.
 */
import { defineEcConfig } from 'astro-expressive-code';
import themes from './src/generated/code-themes.json' with { type: 'json' };
import { focusableCode } from './src/styles/focusable-code.ts';

export default defineEcConfig({
  // Built from the palette tokens by scripts/data/code-themes.ts.
  themes: [themes.dark, themes.light],
  plugins: [focusableCode()],
  styleOverrides: {
    borderRadius: '10px',
    borderColor: 'var(--border)',
    codeFontSize: '0.84rem',
    codeLineHeight: '1.65',
    codePaddingBlock: '0.9rem',
    codePaddingInline: '1.1rem',
    frames: {
      frameBoxShadowCssValue: 'none',
      editorTabBarBorderBottomColor: 'var(--border)',
      terminalTitlebarBorderBottomColor: 'var(--border)',
      // The copy button: outlined on the code's own background, no gray fill.
      inlineButtonBorder: 'var(--border-strong)',
      inlineButtonBorderOpacity: '1',
      inlineButtonForeground: 'var(--muted-foreground)',
      inlineButtonBackground: 'var(--marigold)',
      inlineButtonBackgroundIdleOpacity: '0',
      inlineButtonBackgroundHoverOrFocusOpacity: '0.12',
      inlineButtonBackgroundActiveOpacity: '0.2',
      tooltipSuccessBackground: 'var(--success)',
    },
  },
});
