/**
 * The code theme: VS Code-format themes built from the palette tokens, so code blocks use the
 * same ink, paper and earth tones as the dashboard's code views. Syntax colors stay few: keywords,
 * strings, types, numbers and comments; everything else is ink.
 */
import { palette, type Theme } from './palette.ts';

export function codeTheme(theme: Theme) {
  const p = palette(theme);
  const color = (name: string): string => {
    const value = p[name];
    if (value === undefined) throw new Error(`Unknown palette token --${name}`);
    return value;
  };
  return {
    name: `swaggerz-${theme}`,
    type: theme,
    colors: {
      'editor.background': color('surface'),
      'editor.foreground': color('text-strong'),
      'editor.selectionBackground': color('highlight'),
      'editorLineNumber.foreground': color('faint-foreground'),
      'editorGroupHeader.tabsBackground': color('surface-sunken'),
      'editorGroupHeader.tabsBorder': color('border'),
      'tab.activeBackground': color('surface'),
      'tab.activeForeground': color('text-strong'),
      'tab.inactiveForeground': color('muted-foreground'),
      'tab.activeBorderTop': color('marigold'),
      'tab.border': color('border'),
      'titleBar.activeBackground': color('surface-sunken'),
      'titleBar.activeForeground': color('muted-foreground'),
      'titleBar.border': color('border'),
      'terminal.background': color('surface'),
      'terminal.foreground': color('text-strong'),
      focusBorder: color('ring'),
    },
    tokenColors: [
      {
        scope: ['comment', 'punctuation.definition.comment', 'comment.block.documentation'],
        settings: { foreground: color('code-comment'), fontStyle: 'italic' },
      },
      {
        scope: [
          'keyword',
          'storage',
          'storage.type',
          'storage.modifier',
          'keyword.control',
          'keyword.operator.new',
          'keyword.operator.expression',
          'keyword.operator.type',
          'variable.language.this',
        ],
        settings: { foreground: color('code-keyword') },
      },
      {
        scope: ['string', 'string.quoted', 'string.template', 'punctuation.definition.string'],
        settings: { foreground: color('code-string') },
      },
      {
        scope: ['constant.numeric', 'constant.language', 'constant.character.escape'],
        settings: { foreground: color('code-number') },
      },
      {
        scope: [
          'entity.name.type',
          'support.type',
          'support.class',
          'entity.name.class',
          'entity.other.inherited-class',
          'storage.type.class.jsdoc',
          'entity.name.type.instance.jsdoc',
        ],
        settings: { foreground: color('code-type') },
      },
      {
        // Keys of YAML and JSON documents, the specifications the site shows most.
        scope: ['entity.name.tag', 'support.type.property-name', 'meta.mapping.key string'],
        settings: { foreground: color('code-keyword') },
      },
      {
        scope: [
          'entity.name.function',
          'support.function',
          'meta.function-call entity.name.function',
        ],
        settings: { foreground: color('text-strong'), fontStyle: '' },
      },
      {
        scope: ['punctuation', 'meta.brace', 'keyword.operator'],
        settings: { foreground: color('muted-foreground') },
      },
      {
        scope: ['markup.inserted', 'meta.diff.header.to-file'],
        settings: { foreground: color('success') },
      },
      {
        scope: ['markup.deleted', 'meta.diff.header.from-file'],
        settings: { foreground: color('danger') },
      },
    ],
  };
}
