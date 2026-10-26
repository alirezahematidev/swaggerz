import { describe, expect, it } from 'vitest';
import {
  booleanRate,
  dateWhen,
  numberRange,
  singular,
  textKind,
  words,
} from '../../../src/codegen/mocks/semantics.ts';
import {
  dateNear,
  Fake,
  fileContent,
  generateText,
  matchesPattern,
  Random,
  samplePattern,
  seedOfEntity,
} from '../../../src/templates/mocks/fake.ts';

describe('pattern sampling', () => {
  it.each([
    '^[A-Z]{3}-\\d{4}$',
    '^\\w+@example\\.(com|org)$',
    '^(?:[a-f0-9]{2}:){5}[a-f0-9]{2}$',
    '^[^\\s/]+/[^\\s/]+$',
    '^v\\d+(\\.\\d+){2}(-[a-z]+)?$',
    '[\\s\\S]{3}',
    '^\\u0041\\x42\\u{43}[\\-_.]$',
    '^(?<year>\\d{4})-(?<month>0[1-9]|1[0-2])$',
    // Lookarounds, backreferences, Unicode properties, anchors, boundaries and control escapes.
    '^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[!@#$%^&*]).{8,}$',
    '^(?!admin)[a-z]{5}$',
    '(?<=\\$)\\d+',
    '^(?<!x)y$',
    '^(\\w+)-\\1$',
    '^(?<word>[a-z]{3})_\\k<word>$',
    '^\\p{Lu}\\p{Ll}+$',
    '^[\\p{L}\\d]{4}$',
    '^\\p{Script=Greek}{3}$',
    '^\\P{L}+$',
    '\\bcat\\b',
    '^\\cJ$',
    '^(?i:abc)$',
  ])('generates a string matching %s', (pattern) => {
    const random = Random.of(pattern);
    for (let index = 0; index < 5; index++) {
      const text = samplePattern(pattern, random);
      expect(text).toBeDefined();
      expect(new RegExp(pattern, 'u').test(text ?? '')).toBe(true);
      expect(matchesPattern(pattern, text ?? '')).toBe(true);
    }
  });

  it('reaches a minimum length through unbounded quantifiers and respects the maximum', () => {
    const text = samplePattern('^\\d+$', Random.of('x'), 8);
    expect(text).toMatch(/^\d{8,}$/);
    expect(samplePattern('^\\d{5}$', Random.of('x'), 0, 3)).toBeUndefined();
  });

  it('gives up on invalid patterns and on patterns no string matches', () => {
    for (const pattern of ['^(a', '[z-a]', '^\\p{NotAProperty}$', '^(?=x)y$', '^\\k<nope>$'])
      expect(samplePattern(pattern, Random.of(pattern))).toBeUndefined();
    expect(matchesPattern('^(a', 'a')).toBeUndefined();
  });

  it('matches like RegExp without running the pattern, and stops on a step budget', () => {
    for (const [pattern, text, expected] of [
      ['^a+$', 'aaa', true],
      ['^(a|ab)c$', 'abc', true],
      ['(?<!\\$)\\b\\d+\\b', '$12', false],
      ['^(?:a+)+b$', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaac', false],
    ] as const)
      expect(matchesPattern(pattern, text)).toBe(expected);
  });

  it('is deterministic for a seed', () => {
    expect(samplePattern('^[a-z]{12}$', Random.of('seed'))).toBe(
      samplePattern('^[a-z]{12}$', Random.of('seed')),
    );
  });
});

describe('fake data', () => {
  const random = (): Random => Random.of('fake');
  const luhn = (digits: string): boolean =>
    Array.from(digits)
      .reverse()
      .reduce((sum, char, index) => {
        let digit = Number(char);
        if (index % 2 === 1) digit = digit * 2 > 9 ? digit * 2 - 9 : digit * 2;
        return sum + digit;
      }, 0) %
      10 ===
    0;

  it('makes realistic text of every kind', () => {
    const r = random();
    expect(generateText('email', r, 'ada@taskflow.dev')).toMatch(/^[a-z]+\.[a-z]+@taskflow\.dev$/);
    expect(generateText('fullName', r)).toMatch(/^\S+ \S+$/);
    expect(generateText('uuid', r)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(generateText('color', r)).toMatch(/^#[0-9a-f]{6}$/);
    expect(generateText('ipv4', r)).toMatch(/^(192\.0\.2|198\.51\.100|203\.0\.113)\.\d+$/);
    expect(generateText('imageUrl', r)).toMatch(/^data:image\/svg\+xml,/);
    expect(generateText('url', r, 'https://api.taskflow.dev/x')).toMatch(
      /^https:\/\/api\.taskflow\.dev\//,
    );
    expect(luhn(generateText('creditCard', r))).toBe(true);
    const isbn = generateText('isbn', r);
    const weighted = Array.from(isbn).reduce(
      (sum, d, i) => sum + Number(d) * (i % 2 === 0 ? 1 : 3),
      0,
    );
    expect(weighted % 10).toBe(0);
    const iban = generateText('iban', r);
    const numeric = `${iban.slice(4)}${iban.slice(0, 4)}`.replace(/[A-Z]/g, (c) =>
      String(c.charCodeAt(0) - 55),
    );
    expect(Array.from(numeric).reduce((rest, d) => (rest * 10 + Number(d)) % 97, 0)).toBe(1);
    expect(generateText('like', r, 'usr_3k9f2a7d1b')).toMatch(/^usr_[0-9a-z]{10}$/);
    expect(generateText('like', r, 'WEB-12')).toMatch(/^[A-Z]{3}-\d{2}$/);
    expect(generateText('words', r, '', 30, 30)).toHaveLength(30);
  });

  it('places dates by what they are', () => {
    const r = random();
    const example = '2026-10-20T09:30:00.000Z';
    for (let index = 0; index < 20; index++) {
      expect(Date.parse(dateNear(example, 'date-time', 'past', r))).toBeLessThan(
        Date.parse(example),
      );
      expect(Date.parse(dateNear(example, 'date-time', 'future', r))).toBeGreaterThan(
        Date.parse(example),
      );
      expect(dateNear('2026-11-02', 'date', 'soon', r)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(dateNear('09:30:00Z', 'time', 'any', r)).toMatch(/^\d{2}:\d{2}:\d{2}Z$/);
    }
    expect(dateNear('2026-10-20T09:30:00Z', 'date-time', 'any', r)).toMatch(/:\d{2}Z$/);
  });

  it('makes real files of their media type', async () => {
    const magic = async (blob: Blob, bytes: number): Promise<number[]> => [
      ...new Uint8Array(await blob.slice(0, bytes).arrayBuffer()),
    ];
    expect(await magic(fileContent('image/png', random()), 4)).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(await magic(fileContent('image/jpeg', random()), 2)).toEqual([0xff, 0xd8]);
    expect(await fileContent('application/pdf', random()).text()).toMatch(
      /^%PDF-1\.4[\s\S]*%%EOF\n$/,
    );
    expect(await magic(fileContent('audio/wav', random()), 4)).toEqual([0x52, 0x49, 0x46, 0x46]);
    expect(await fileContent('text/csv', random()).text()).toMatch(/^id,name,email\n/);
    // Wildcards and unknown types follow the property's name.
    expect(fileContent('image/*', random(), 'avatar').type).toBe('image/png');
    expect(fileContent('', random(), 'invoice').type).toBe('application/pdf');
  });

  it('makes the examples for seed 0 and other values, the same each time, for other seeds', () => {
    const canonical = new Fake();
    const seeded = new Fake({ seed: 9 });
    expect(canonical.text('name', 'Ada', 'fullName')).toBe('Ada');
    expect(seeded.text('name', 'Ada', 'fullName')).toBe(
      new Fake({ seed: 9 }).text('name', 'Ada', 'fullName'),
    );
    expect(seeded.pick('kind', ['a', 'b', 'c'])).toBe(
      new Fake({ seed: 9 }).pick('kind', ['a', 'b', 'c']),
    );
    expect(canonical.nullable('x', () => 1)).toBe(1);
    expect(canonical.array('xs', 3, 0, 5, (f, i) => f.text('t', `x${i}`, 'tag'))).toEqual([
      'x0',
      expect.any(String),
      expect.any(String),
    ]);
    expect(new Fake({ empty: true }).array('xs', 3, 1, 5, () => 0)).toEqual([0]);
    const kept = new Fake({ seed: 1 });
    for (let seed = 1; seed < 40; seed++) {
      const value = new Fake({ seed }).optional('', { a: 1, b: 2 }, ['a', 'b'], { b: 3 });
      expect(value).toHaveProperty('b');
    }
    expect(kept.example((examples) => (examples ? { a: 1 } : { a: 2 }))).toEqual({ a: 2 });
    expect(canonical.example((examples) => (examples ? { a: 1 } : { a: 2 }))).toEqual({ a: 1 });
    // Ids are remembered with the seed that made them.
    new Fake({ seed: 42 }).id('pet-42');
    expect(seedOfEntity('pet-42')).toBe(42);
  });
});

describe('semantics', () => {
  it('reads names', () => {
    expect(words('avatarColor')).toEqual(['avatar', 'color']);
    expect(words('created_at')).toEqual(['created', 'at']);
    expect(words('HTTPStatus')).toEqual(['http', 'status']);
    expect(singular('categories')).toBe('category');
    expect(singular('photoUrls')).toBe('photoUrl');
    expect(singular('status')).toBe('status');
  });

  it('infers text from the format, the name and the owner', () => {
    expect(textKind('contact', undefined, 'email')).toBe('email');
    expect(textKind('avatarUrl', undefined, 'uri')).toBe('avatarUrl');
    expect(textKind('name', 'User', undefined)).toBe('fullName');
    expect(textKind('name', 'Project', undefined)).toBe('project');
    expect(textKind('name', 'Label', undefined)).toBe('tag');
    expect(textKind('title', 'Task', undefined)).toBe('task');
    expect(textKind('title', 'Member', undefined)).toBe('jobTitle');
    expect(textKind('description', undefined, undefined)).toBe('paragraph');
    expect(textKind('postalCode', undefined, undefined)).toBe('postalCode');
    expect(textKind('accessToken', undefined, undefined)).toBe('jwt');
    // Identifiers with an example keep its shape.
    expect(textKind('id', 'Task', undefined)).toBe('uuid');
    expect(textKind('id', 'Task', undefined, 'tsk_3k9f2a7d1b')).toBeUndefined();
    expect(textKind('flavor', undefined, undefined)).toBeUndefined();
  });

  it('infers ranges, rates and dates from names', () => {
    expect(numberRange('age', true)).toEqual({ min: 18, max: 80 });
    expect(numberRange('price', false)).toEqual({ min: 1, max: 999, digits: 2 });
    expect(numberRange('commentCount', true)).toEqual({ min: 0, max: 50 });
    expect(numberRange('flavor', true)).toBeUndefined();
    expect(booleanRate('archived')).toBeLessThan(0.5);
    expect(booleanRate('isActive')).toBeGreaterThan(0.5);
    expect(dateWhen('createdAt')).toBe('past');
    expect(dateWhen('dueDate')).toBe('soon');
    expect(dateWhen('expiresAt')).toBe('future');
    expect(dateWhen('birthDate')).toBe('birth');
  });
});
