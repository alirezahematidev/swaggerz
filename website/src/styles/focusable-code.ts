/**
 * An Expressive Code plugin that makes every code block keyboard-scrollable: a `<pre>` whose
 * lines overflow scrolls sideways, and a scrolling region must be reachable with the keyboard
 * (WCAG 2.1.1).
 */
import type { ExpressiveCodePlugin } from 'astro-expressive-code';

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

function visit(node: HastNode, callback: (node: HastNode) => void): void {
  callback(node);
  for (const child of node.children ?? []) visit(child, callback);
}

export function focusableCode(): ExpressiveCodePlugin {
  return {
    name: 'swaggerz-focusable-code',
    hooks: {
      postprocessRenderedBlock: ({ renderData }) => {
        visit(renderData.blockAst, (node) => {
          if (node.type === 'element' && node.tagName === 'pre') {
            node.properties = { ...node.properties, tabIndex: 0 };
          }
        });
      },
    },
  };
}
