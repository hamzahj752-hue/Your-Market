// Safe parser for public.products.details.
//
// CURRENT ADMIN CANONICAL CONTRACT:
//
// {
//   highlights?: [
//     {
//       text: string;
//       icon?: string;
//     }
//   ];
//   specifications?: [
//     {
//       group: string;
//       entries: [
//         {
//           label: string;
//           value: string;
//         }
//       ]
//     }
//   ];
//   packageContents?: string[];
//   delivery?: string;
//   warranty?: string;
//   returns?: string;
// }
//
// BACKWARD COMPATIBILITY:
//
// Older Admin/Customer code stored highlights as plain strings:
//
//   highlights?: string[]
//
// and used legacy specification rows:
//
//   specifications[].items[].key/value
//
// This parser accepts BOTH formats so existing products do not break. Every
// highlight is normalized into an object with a `text` and an optional `icon`;
// specification items are normalized into `items[].key/value` for the UI.
//
// Everything is rendered as plain React text.
// No HTML is trusted or rendered.

export interface SpecItem {
  key: string;
  value: string;
}

export interface SpecGroup {
  group: string;
  items: SpecItem[];
}

/** One product highlight: real admin copy plus an optional predefined icon name. */
export interface HighlightItem {
  text: string;
  icon: string | null;
}

export interface ProductDetails {
  highlights: HighlightItem[];
  specifications: SpecGroup[];
  packageContents: string[];
  delivery: string | null;
  warranty: string | null;
  returns: string | null;
}

const MAX_TEXT_LENGTH = 2000;
const MAX_SHORT_TEXT_LENGTH = 500;

const MAX_HIGHLIGHTS = 30;
const MAX_PACKAGE_ITEMS = 30;
const MAX_SPEC_GROUPS = 30;
const MAX_SPEC_ITEMS_PER_GROUP = 60;

const MAX_ICON_NAME_LENGTH = 80;

function asSafeString(
  value: unknown,
  fallback: string | null = null,
  maxLength = MAX_TEXT_LENGTH
): string | null {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return fallback;
  }

  return trimmed.slice(0, maxLength);
}

function asStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: string[] = [];

  for (const item of value) {
    if (result.length >= maxItems) {
      break;
    }

    const text = asSafeString(item, null, MAX_SHORT_TEXT_LENGTH);

    if (text) {
      result.push(text);
    }
  }

  return result;
}

/**
 * Parses the Admin Highlight list.
 *
 * Accepts BOTH formats:
 *  - modern: { text, icon? }
 *  - legacy: plain string (icon resolves to null)
 *
 * The icon is just a guarded, short token passed to the storefront Icon
 * component; an unknown value falls back safely to the generic feature icon.
 */
function asHighlightItems(value: unknown): HighlightItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: HighlightItem[] = [];

  for (const raw of value) {
    if (result.length >= MAX_HIGHLIGHTS) {
      break;
    }

    if (typeof raw === 'string') {
      const text = asSafeString(raw, null, MAX_SHORT_TEXT_LENGTH);
      if (text) {
        result.push({ text, icon: null });
      }
      continue;
    }

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      continue;
    }

    const row = raw as Record<string, unknown>;

    const text = asSafeString(row.text, null, MAX_SHORT_TEXT_LENGTH);

    if (!text) {
      continue;
    }

    const rawIcon = typeof row.icon === 'string' ? row.icon.trim() : '';

    const icon = rawIcon
      ? rawIcon.slice(0, MAX_ICON_NAME_LENGTH).replace(/[^A-Za-z0-9]/g, '')
      : null;

    result.push({
      text,
      icon: icon || null,
    });
  }

  return result;
}

/**
 * NEW canonical Admin format:
 *
 * entries: [
 *   {
 *     label: "...",
 *     value: "..."
 *   }
 * ]
 */
function parseCanonicalEntries(value: unknown): SpecItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: SpecItem[] = [];

  for (const raw of value) {
    if (result.length >= MAX_SPEC_ITEMS_PER_GROUP) {
      break;
    }

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      continue;
    }

    const row = raw as Record<string, unknown>;

    const key = asSafeString(row.label, null, MAX_SHORT_TEXT_LENGTH);

    const itemValue = asSafeString(row.value, null, MAX_SHORT_TEXT_LENGTH);

    if (key && itemValue) {
      result.push({
        key,
        value: itemValue,
      });
    }
  }

  return result;
}

/**
 * OLD Customer/Admin format:
 *
 * items: [
 *   {
 *     key: "...",
 *     value: "..."
 *   }
 * ]
 *
 * Kept only for backward compatibility.
 */
function parseLegacyItems(value: unknown): SpecItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: SpecItem[] = [];

  for (const raw of value) {
    if (result.length >= MAX_SPEC_ITEMS_PER_GROUP) {
      break;
    }

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      continue;
    }

    const row = raw as Record<string, unknown>;

    const key = asSafeString(row.key, null, MAX_SHORT_TEXT_LENGTH);

    const itemValue = asSafeString(row.value, null, MAX_SHORT_TEXT_LENGTH);

    if (key && itemValue) {
      result.push({
        key,
        value: itemValue,
      });
    }
  }

  return result;
}

function parseSpecificationGroups(value: unknown): SpecGroup[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: SpecGroup[] = [];

  for (const groupRaw of value) {
    if (result.length >= MAX_SPEC_GROUPS) {
      break;
    }

    if (!groupRaw || typeof groupRaw !== 'object' || Array.isArray(groupRaw)) {
      continue;
    }

    const group = groupRaw as Record<string, unknown>;

    const groupName = asSafeString(group.group, '', MAX_SHORT_TEXT_LENGTH) ?? '';

    /*
     * Prefer the CURRENT canonical Admin
     * contract.
     */
    let items = parseCanonicalEntries(group.entries);

    /*
     * Fall back to the old Customer/Admin
     * contract for existing products.
     */
    if (items.length === 0) {
      items = parseLegacyItems(group.items);
    }

    if (items.length > 0) {
      result.push({
        group: groupName,
        items,
      });
    }
  }

  return result;
}

export function parseProductDetails(value: unknown): ProductDetails {
  const empty: ProductDetails = {
    highlights: [],
    specifications: [],
    packageContents: [],
    delivery: null,
    warranty: null,
    returns: null,
  };

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return empty;
  }

  const raw = value as Record<string, unknown>;

  return {
    highlights: asHighlightItems(raw.highlights),

    specifications: parseSpecificationGroups(raw.specifications),

    packageContents: asStringArray(raw.packageContents, MAX_PACKAGE_ITEMS),

    delivery: asSafeString(raw.delivery),

    warranty: asSafeString(raw.warranty),

    returns: asSafeString(raw.returns),
  };
}

export function hasProductDetails(details: ProductDetails): boolean {
  return (
    details.highlights.length > 0 ||
    details.specifications.length > 0 ||
    details.packageContents.length > 0 ||
    Boolean(details.delivery) ||
    Boolean(details.warranty) ||
    Boolean(details.returns)
  );
}
