/**
 * Section headings of the pages rendered from generated data. The components render them and the
 * route middleware adds them to "On this page", so both use this one list.
 */
import api from '../generated/api.json';
import cli from '../generated/cli.json';
import config from '../generated/config.json';
import diagnostics from '../generated/diagnostics.json';

export interface Heading {
  readonly depth: number;
  readonly slug: string;
  readonly text: string;
}

const AREA_TITLES: Readonly<Record<string, string>> = {
  config: 'Configuration',
  spec: 'Specification',
  overlay: 'Overlays',
  ref: 'References',
  schema: 'Schemas',
  operation: 'Operations',
  security: 'Security',
  naming: 'Naming',
  query: 'Data fetching',
  mock: 'Mocks',
  output: 'Output',
  plugin: 'Plugins',
  dashboard: 'Dashboard',
  internal: 'Internal',
  lint: 'Lint findings',
};

/** The title of a diagnostic area; a new area needs one above, or the build fails. */
export function areaTitle(area: string): string {
  const title = AREA_TITLES[area];
  if (title === undefined)
    throw new Error(`No title for the diagnostic area "${area}" (AREA_TITLES).`);
  return title;
}

export function areas(): string[] {
  return [...new Set(diagnostics.entries.map((entry) => entry.area))];
}

export function configGroups(): string[] {
  return [...new Set(config.options.map((option) => option.path.split('.')[0] ?? option.path))];
}

export const API_SECTIONS = [
  { kind: 'function', title: 'Functions', experimental: false },
  { kind: 'class', title: 'Classes', experimental: false },
  { kind: 'interface', title: 'Configuration and result types', experimental: false },
  { kind: 'type', title: 'Type aliases', experimental: false },
  { kind: 'experimental', title: 'Experimental: the IR and the project model', experimental: true },
] as const;

export function apiSection(item: { kind: string; experimental: boolean }): string {
  if (item.experimental) return 'experimental';
  return item.kind === 'variable' ? 'function' : item.kind;
}

const slug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function headingsFor(id: string): Heading[] {
  switch (id) {
    case 'docs/reference/cli':
      return [
        { depth: 2, slug: 'commands', text: 'Commands' },
        ...cli.commands.map((command) => ({
          depth: 3,
          slug: `command-${command.name}`,
          text: command.name,
        })),
        { depth: 2, slug: 'global-options', text: 'Global options' },
        { depth: 2, slug: 'exit-codes', text: 'Exit codes' },
      ];
    case 'docs/reference/config':
      return [
        ...configGroups().map((group) => ({ depth: 2, slug: `group-${slug(group)}`, text: group })),
        { depth: 2, slug: 'environment-variables', text: 'Environment variables' },
      ];
    case 'docs/reference/api':
      return API_SECTIONS.filter((section) =>
        api.exports.some((item) => apiSection(item) === section.kind),
      ).map((section) => ({ depth: 2, slug: section.kind, text: section.title }));
    case 'docs/reference/diagnostics':
      return areas().map((area) => ({
        depth: 2,
        slug: `area-${area}`,
        text: areaTitle(area),
      }));
    default:
      return [];
  }
}

export const diagnosticAnchor = (code: string): string => code.replace('/', '-');
