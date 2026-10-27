import type { DateWhen, ErrorPart, TextKind } from '../../templates/mocks/fake.ts';

/**
 * What a value's name says about it: `email` is an email address, `avatarUrl` a picture, `price`
 * an amount of money, `createdAt` a date in the past. Fixtures use it to make realistic values.
 */

/** The lowercase words of an identifier: `avatarColor`, `avatar_color` → `['avatar', 'color']`. */
export function words(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== '');
}

/** The singular of an array property's name, for its items (`tags` → `tag`, `photoUrls` → `photoUrl`). */
export function singular(name: string): string {
  if (name.endsWith('ies')) return `${name.slice(0, -3)}y`;
  if (/(ss|us|is)$/.test(name)) return name;
  if (/(x|ch|sh|ses)es$/.test(name)) return name.slice(0, -2);
  return name.endsWith('s') ? name.slice(0, -1) : name;
}

const PERSON =
  /user|person|people|member|author|owner|customer|client|contact|employee|staff|account|profile|assignee|reporter|actor|agent|admin|player|student|teacher|patient|driver|guest|participant|attendee|recipient|sender|creator|editor|reviewer|subscriber|buyer|seller|candidate|applicant|speaker|host|manager|lead|uploader|commenter|follower|friend/i;
const COMPANY =
  /company|organi[sz]ation|^org$|business|vendor|supplier|merchant|brand|employer|tenant|workspace|partner/i;
const PRODUCT = /product|item|good|offer|plan|service|sku|variant|book|course/i;
const PROJECT = /project|repo|repository|app|application|board|campaign|initiative|program/i;
const TAG = /tag|label|category|topic|genre|keyword|group|role|skill|badge/i;
const FILE = /file|attachment|document|asset|upload|media|image|photo|picture|video|audio/i;
const TASK = /task|issue|ticket|todo|story|bug|card|job|step|milestone|goal|todo|incident/i;
const PLACE = /city|place|location|venue|store|shop|restaurant|hotel|office|branch|warehouse|site/i;
const PET = /pet|animal|dog|cat|horse|bird/i;
const TEAM = /team|department|division|unit|squad/i;

/** The text a string format stands for. */
const FORMATS: Readonly<Record<string, TextKind>> = {
  email: 'email',
  'idn-email': 'email',
  hostname: 'domain',
  'idn-hostname': 'domain',
  ipv4: 'ipv4',
  ipv6: 'ipv6',
  uri: 'url',
  url: 'url',
  iri: 'url',
  'uri-reference': 'uriReference',
  'iri-reference': 'uriReference',
  'uri-template': 'uriTemplate',
  uuid: 'uuid',
  guid: 'uuid',
  byte: 'base64',
  base64: 'base64',
  base64url: 'token',
  password: 'password',
  'json-pointer': 'pointer',
  'relative-json-pointer': 'relativePointer',
  regex: 'regex',
  int8: 'integer',
  int16: 'integer',
  int32: 'integer',
  int64: 'integer',
  uint8: 'integer',
  uint16: 'integer',
  uint32: 'integer',
  uint64: 'integer',
  integer: 'integer',
  number: 'decimal',
  decimal: 'decimal',
  double: 'decimal',
  float: 'decimal',
  duration: 'duration',
  phone: 'phone',
  tel: 'phone',
  color: 'color',
  'hex-color': 'color',
  mac: 'mac',
  semver: 'semver',
  'iso-country': 'countryCode',
  'country-code': 'countryCode',
  currency: 'currency',
  'iso-currency': 'currency',
  language: 'language',
  bcp47: 'locale',
  locale: 'locale',
  timezone: 'timezone',
  'mime-type': 'mimeType',
  'media-type': 'mimeType',
  isbn: 'isbn',
  iban: 'iban',
  'credit-card': 'creditCard',
  jwt: 'jwt',
  ulid: 'code',
  cuid: 'token',
  nanoid: 'token',
};

const IMAGE = [
  'avatar',
  'photo',
  'picture',
  'image',
  'img',
  'thumbnail',
  'logo',
  'icon',
  'banner',
  'cover',
];

/**
 * The kind of text a string property holds, from its format, its name and the model it belongs
 * to (`name` of a `User` is a person's name, of a `Project` a project's), or `undefined`.
 */
export function textKind(
  name: string | undefined,
  owner: string | undefined,
  format: string | undefined,
  example?: string,
): TextKind | undefined {
  const all = words(name ?? '');
  const has = (...candidates: string[]): boolean => candidates.some((word) => all.includes(word));
  const fromFormat = format === undefined ? undefined : FORMATS[format.toLowerCase()];
  if (fromFormat === 'url' && has(...IMAGE))
    return has('avatar', 'logo', 'icon') ? 'avatarUrl' : 'imageUrl';
  if (fromFormat !== undefined) return fromFormat;
  const fromName = nameKind(all, owner);
  // An identifier's example shows its shape (`usr_3k9f2a7d1b`), which its variants keep.
  return example !== undefined && fromName !== undefined && IDENTIFIERS.has(fromName)
    ? undefined
    : fromName;
}

/** Kinds of identifiers, whose examples are better varied than replaced. */
const IDENTIFIERS: ReadonlySet<TextKind> = new Set([
  'uuid',
  'code',
  'token',
  'hash',
  'slug',
  'sku',
]);

function nameKind(all: readonly string[], owner: string | undefined): TextKind | undefined {
  const last = all.at(-1) ?? '';
  const joined = all.join('');
  const has = (...candidates: string[]): boolean => candidates.some((word) => all.includes(word));
  if (joined === '') return undefined;
  if (last === 'email' || last === 'mail' || joined.endsWith('email')) return 'email';
  if (
    ['phone', 'mobile', 'tel', 'telephone', 'fax', 'cell', 'phonenumber'].includes(last) ||
    joined.endsWith('phonenumber')
  )
    return 'phone';
  if (
    ['url', 'uri', 'href', 'link', 'website', 'homepage', 'site'].includes(last) ||
    (has(...IMAGE) && ['src', 'source'].includes(last))
  )
    return has(...IMAGE) ? (has('avatar', 'logo', 'icon') ? 'avatarUrl' : 'imageUrl') : 'url';
  if (['avatar', 'photo', 'picture', 'image', 'thumbnail', 'logo'].includes(joined))
    return joined === 'avatar' || joined === 'logo' ? 'avatarUrl' : 'imageUrl';
  if (['firstname', 'givenname', 'forename', 'middlename'].includes(joined)) return 'firstName';
  if (['lastname', 'surname', 'familyname'].includes(joined)) return 'lastName';
  if (['fullname', 'displayname', 'realname', 'contactname', 'authorname'].includes(joined))
    return 'fullName';
  if (['username', 'login', 'handle', 'nickname', 'screenname', 'userhandle'].includes(joined))
    return 'username';
  if (last === 'name') {
    const subject = all.length > 1 ? all.slice(0, -1).join('') : (owner ?? '');
    if (/^(company|organi[sz]ation|business|vendor|brand)/.test(subject)) return 'company';
    if (FILE.test(subject)) return 'fileName';
    if (PERSON.test(subject)) return 'fullName';
    if (PET.test(subject)) return 'firstName';
    if (COMPANY.test(subject)) return 'company';
    if (TEAM.test(subject)) return 'department';
    if (TAG.test(subject)) return 'tag';
    if (PRODUCT.test(subject)) return 'product';
    if (PLACE.test(subject)) return 'city';
    if (PROJECT.test(subject)) return 'project';
    return 'project';
  }
  if (last === 'title' || joined === 'heading' || joined === 'headline' || joined === 'subject') {
    if (PERSON.test(owner ?? '') || has('job')) return 'jobTitle';
    if (TASK.test(owner ?? '')) return 'task';
    return 'headline';
  }
  if (
    ['description', 'body', 'content', 'details', 'bio', 'about', 'overview', 'biography'].includes(
      last,
    )
  )
    return 'paragraph';
  if (
    [
      'summary',
      'note',
      'notes',
      'comment',
      'message',
      'caption',
      'excerpt',
      'reason',
      'remark',
      'remarks',
      'feedback',
      'text',
      'tagline',
      'instructions',
      'answer',
      'question',
      'review',
      'quote',
      'motto',
    ].includes(last)
  )
    return 'sentence';
  if (
    [
      'street',
      'address1',
      'addressline1',
      'line1',
      'streetaddress',
      'address2',
      'addressline2',
      'line2',
    ].includes(joined)
  )
    return 'street';
  if (['city', 'town', 'locality', 'municipality'].includes(last)) return 'city';
  if (['state', 'province', 'region', 'county', 'prefecture'].includes(last)) return 'state';
  if (joined === 'country' || joined === 'countryname' || joined === 'nationality')
    return 'country';
  if (['countrycode', 'countryiso', 'iso2', 'alpha2'].includes(joined)) return 'countryCode';
  if (['zip', 'zipcode', 'postalcode', 'postcode', 'postal'].includes(joined)) return 'postalCode';
  if (last === 'address' && !has('email', 'ip', 'mac', 'wallet')) return 'address';
  if (
    [
      'company',
      'companyname',
      'organization',
      'organisation',
      'org',
      'employer',
      'business',
      'vendor',
      'brand',
      'publisher',
      'manufacturer',
    ].includes(joined)
  )
    return 'company';
  if (['department', 'division', 'team'].includes(last)) return 'department';
  if (['jobtitle', 'occupation', 'profession', 'position', 'role'].includes(joined))
    return 'jobTitle';
  if (['color', 'colour', 'hex', 'background', 'foreground', 'tint'].includes(last)) return 'color';
  if (last === 'currency' || joined === 'currencycode') return 'currency';
  if (last === 'locale') return 'locale';
  if (['language', 'lang', 'languagecode'].includes(joined)) return 'language';
  if (['timezone', 'tz', 'timezonename'].includes(joined)) return 'timezone';
  if (['ip', 'ipaddress', 'ipv4', 'clientip', 'remoteip', 'remoteaddr'].includes(joined))
    return 'ipv4';
  if (joined === 'ipv6') return 'ipv6';
  if (joined === 'mac' || joined === 'macaddress') return 'mac';
  if (joined === 'useragent') return 'userAgent';
  if (['domain', 'hostname', 'host', 'domainname'].includes(joined)) return 'domain';
  if (has('jwt') || joined === 'accesstoken' || joined === 'idtoken') return 'jwt';
  if (
    ['token', 'apikey', 'secret', 'clientsecret', 'nonce', 'csrf', 'signature', 'key'].includes(
      last,
    ) &&
    joined !== 'key'
  )
    return 'token';
  if (['password', 'passwd', 'pwd', 'passphrase'].includes(last)) return 'password';
  if (
    ['hash', 'checksum', 'sha', 'sha1', 'sha256', 'md5', 'etag', 'digest', 'fingerprint'].includes(
      last,
    )
  )
    return 'hash';
  if (joined === 'uuid' || joined === 'guid' || last === 'uuid' || last === 'guid') return 'uuid';
  if (joined === 'slug' || joined === 'permalink') return 'slug';
  // Opaque page cursors (`nextCursor`); `nextPageToken` is a token by its last word already.
  if (last === 'cursor') return 'token';
  if (joined === 'sku') return 'sku';
  if (joined === 'isbn') return 'isbn';
  if (joined === 'iban') return 'iban';
  if (['creditcard', 'cardnumber', 'ccnumber', 'pan'].includes(joined)) return 'creditCard';
  if (['version', 'semver', 'appversion', 'release'].includes(joined)) return 'semver';
  if (joined === 'emoji' || joined === 'reaction') return 'emoji';
  if (['mimetype', 'contenttype', 'mediatype', 'filetype', 'mime'].includes(joined))
    return 'mimeType';
  if (['filename', 'file', 'attachmentname', 'originalname', 'basename'].includes(joined))
    return 'fileName';
  if (['extension', 'ext', 'fileextension'].includes(joined)) return 'fileExtension';
  if (['path', 'filepath', 'directory', 'folder'].includes(joined)) return 'filePath';
  if (['tag', 'label', 'keyword', 'category', 'topic', 'genre', 'hashtag'].includes(joined))
    return 'tag';
  if (['code', 'key', 'reference', 'ref', 'shortcode', 'coupon', 'promocode'].includes(joined))
    return 'code';
  if (last === 'id' || joined === 'id' || (last === 'ids' && all.length > 1)) return 'uuid';
  return undefined;
}

const ERROR_WORDS: ReadonlySet<string> = new Set([
  'problem',
  'error',
  'errors',
  'fault',
  'exception',
  'failure',
  'violation',
  'violations',
]);

/**
 * Whether an object describes an error: its model or property is named like one (`Problem`,
 * `ErrorResponse`, the items of `errors`), or it has the members of RFC 9457 Problem Details.
 */
export function isErrorModel(subject: string | undefined, properties: readonly string[]): boolean {
  if (words(subject ?? '').some((word) => ERROR_WORDS.has(word))) return true;
  const names = new Set(properties);
  return (
    names.has('title') &&
    names.has('status') &&
    (names.has('detail') || names.has('type') || names.has('instance'))
  );
}

const FIELD_NAMES: ReadonlySet<string> = new Set([
  'field',
  'fieldname',
  'param',
  'parameter',
  'property',
  'attribute',
]);
const FIELD_POINTERS: ReadonlySet<string> = new Set([
  'path',
  'pointer',
  'jsonpointer',
  'loc',
  'location',
]);

/** Whether an error is about one field (`{ field, message }`, `{ pointer, detail }`). */
export function isFieldError(properties: readonly string[]): boolean {
  return properties.some((name) => {
    const joined = words(name).join('');
    return FIELD_NAMES.has(joined) || FIELD_POINTERS.has(joined);
  });
}

/**
 * What a string property of an error model says about the error (`title` its reason phrase,
 * `detail` or `message` what went wrong, `code` the status as a code), or `undefined`. In the
 * error of one field (`field`), the message says what is wrong with the field.
 */
export function errorPart(
  name: string | undefined,
  format: string | undefined,
  field: boolean,
  example?: string,
): ErrorPart | undefined {
  const joined = words(name ?? '').join('');
  const message = [
    'detail',
    'details',
    'message',
    'msg',
    'description',
    'errordescription',
    'errormessage',
    'errordetail',
    'errordetails',
  ];
  if (field) {
    if (FIELD_NAMES.has(joined)) return 'field';
    if (FIELD_POINTERS.has(joined)) return 'pointer';
    if ([...message, 'error', 'reason'].includes(joined)) return 'fieldMessage';
  }
  if (['title', 'error', 'errortitle', 'statustext', 'reasonphrase', 'reason'].includes(joined))
    return 'title';
  if (message.includes(joined)) return 'detail';
  if (joined === 'type' || joined === 'errortype') {
    const uri =
      (format !== undefined && /^(uri|url|iri)/i.test(format)) ||
      /^(https?:|about:|urn:)/i.test(example ?? '');
    return uri ? 'type' : 'code';
  }
  if (['code', 'errorcode', 'kind', 'errorkey'].includes(joined)) return 'code';
  if (joined === 'instance') return 'instance';
  return undefined;
}

/** Whether an integer property of an error model is the HTTP status it describes. */
export function isErrorStatus(name: string | undefined): boolean {
  return ['status', 'statuscode', 'httpstatus', 'httpstatuscode', 'httpcode', 'code'].includes(
    words(name ?? '').join(''),
  );
}

/** A realistic range for a number, from its name: `age` 18–80, `price` 1–999.99, `rating` 1–5. */
export interface NumberRange {
  readonly min: number;
  readonly max: number;
  /** Decimals of a `number` (not an `integer`). */
  readonly digits?: number;
}

export function numberRange(name: string | undefined, integer: boolean): NumberRange | undefined {
  const all = words(name ?? '');
  const last = all.at(-1) ?? '';
  const joined = all.join('');
  if (joined === '') return undefined;
  const has = (...candidates: string[]): boolean => candidates.some((word) => all.includes(word));
  if (last === 'id' || joined === 'id') return { min: 1, max: 100_000 };
  if (joined === 'age') return { min: 18, max: 80 };
  if (last === 'year') return { min: 1990, max: 2030 };
  if (last === 'month') return { min: 1, max: 12 };
  if (last === 'day') return { min: 1, max: 28 };
  if (last === 'hour') return { min: 0, max: 23 };
  if (last === 'minute' || last === 'second') return { min: 0, max: 59 };
  if (['lat', 'latitude'].includes(last)) return { min: -90, max: 90, digits: 6 };
  if (['lng', 'lon', 'long', 'longitude'].includes(last)) return { min: -180, max: 180, digits: 6 };
  if (
    has(
      'price',
      'amount',
      'cost',
      'subtotal',
      'fee',
      'balance',
      'salary',
      'revenue',
      'budget',
      'payment',
      'charge',
      'tax',
      'income',
      'spend',
      'value',
    ) ||
    (joined === 'total' && !integer)
  )
    return integer ? { min: 100, max: 99_999 } : { min: 1, max: 999, digits: 2 };
  if (['rating', 'stars'].includes(last))
    return integer ? { min: 1, max: 5 } : { min: 1, max: 5, digits: 1 };
  if (last === 'score') return { min: 0, max: 100 };
  if (['percent', 'percentage', 'progress'].includes(last)) return { min: 0, max: 100 };
  if (
    !integer &&
    ['ratio', 'rate', 'probability', 'share', 'fraction', 'confidence'].includes(last)
  )
    return { min: 0, max: 1, digits: 2 };
  if (last === 'port') return { min: 1024, max: 65_535 };
  if (['bytes', 'filesize', 'size'].includes(joined) || has('bytes'))
    return { min: 1_000, max: 5_000_000 };
  if (['width', 'height'].includes(last)) return { min: 100, max: 2_000 };
  if (['ms', 'millis', 'milliseconds', 'latency'].includes(last)) return { min: 100, max: 60_000 };
  if (
    ['duration', 'timeout', 'ttl', 'delay', 'interval', 'seconds', 'in'].includes(last) ||
    joined.startsWith('expires')
  )
    return { min: 60, max: 86_400 };
  if (
    [
      'likes',
      'views',
      'followers',
      'downloads',
      'stars',
      'visits',
      'impressions',
      'clicks',
    ].includes(last)
  )
    return { min: 0, max: 5_000 };
  if (
    last === 'count' ||
    [
      'quantity',
      'qty',
      'num',
      'number',
      'stock',
      'inventory',
      'votes',
      'attempts',
      'retries',
      'items',
      'total',
    ].includes(last)
  )
    return { min: 0, max: 50 };
  if (['position', 'order', 'index', 'rank', 'sort', 'sequence', 'ordinal'].includes(last))
    return { min: 0, max: 100 };
  if (last === 'page') return { min: 1, max: 10 };
  if (['limit', 'pagesize', 'perpage', 'take'].includes(joined)) return { min: 10, max: 50 };
  if (['offset', 'skip'].includes(joined)) return { min: 0, max: 100 };
  if (last === 'version' || last === 'revision') return { min: 1, max: 10 };
  if (last === 'priority' || last === 'level') return { min: 1, max: 5 };
  if (last === 'weight') return integer ? { min: 1, max: 100 } : { min: 1, max: 100, digits: 1 };
  if (last === 'temperature') return { min: -10, max: 40, digits: 1 };
  return undefined;
}

/** How often a boolean is `true`: rarely for `archived`, usually for `enabled`. */
export function booleanRate(name: string | undefined): number {
  const all = words(name ?? '');
  const has = (...candidates: string[]): boolean => candidates.some((word) => all.includes(word));
  if (
    has(
      'archived',
      'deleted',
      'disabled',
      'banned',
      'blocked',
      'locked',
      'hidden',
      'spam',
      'flagged',
      'failed',
      'expired',
      'suspended',
      'draft',
      'deprecated',
      'muted',
      'error',
      'test',
      'internal',
    )
  )
    return 0.15;
  if (
    has(
      'enabled',
      'active',
      'verified',
      'visible',
      'available',
      'published',
      'confirmed',
      'approved',
      'valid',
      'success',
      'online',
      'public',
      'paid',
      'complete',
      'completed',
      'ok',
    )
  )
    return 0.85;
  return 0.5;
}

/** Where a date lies by its name: `createdAt` in the past, `dueDate` soon, `birthDate` years ago. */
export function dateWhen(name: string | undefined): DateWhen {
  const all = words(name ?? '');
  const has = (...candidates: string[]): boolean => candidates.some((word) => all.includes(word));
  if (has('birth', 'dob', 'born', 'birthday')) return 'birth';
  if (has('due', 'deadline', 'start', 'starts', 'begins', 'scheduled', 'eta')) return 'soon';
  if (
    has(
      'expires',
      'expiry',
      'expiration',
      'ends',
      'end',
      'until',
      'renew',
      'renews',
      'next',
      'valid',
    )
  )
    return 'future';
  if (
    has(
      'created',
      'updated',
      'modified',
      'deleted',
      'published',
      'posted',
      'sent',
      'received',
      'joined',
      'registered',
      'signed',
      'last',
      'completed',
      'finished',
      'closed',
      'resolved',
      'archived',
      'uploaded',
      'edited',
      'seen',
      'visited',
      'logged',
      'login',
      'accessed',
      'occurred',
      'happened',
      'timestamp',
      'issued',
      'paid',
      'shipped',
      'delivered',
      'verified',
      'cancelled',
      'canceled',
    )
  )
    return 'past';
  return 'any';
}

/** Array properties that hold the items of a list or a page (`items`, `data`, `results`…). */
export function isCollection(name: string | undefined): boolean {
  return /^(items|data|results|records|entries|rows|nodes|edges|content|list|elements|hits|objects|values|docs|documents)$/i.test(
    name ?? '',
  );
}

/** Properties of a page next to its items (`nextCursor`, `total`, `hasMore`…). */
export function isPageProperty(name: string): boolean {
  return /^(next|prev|previous|cursor|nextcursor|prevcursor|total|totalcount|count|page|pages|pagesize|limit|offset|hasmore|hasnext|nextpage|nexttoken|nextpagetoken|totalpages|totalitems|links)$/i.test(
    name.replace(/[_-]/g, ''),
  );
}
