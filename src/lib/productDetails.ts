// Safe, backward-compatible parsing of the `products.details` JSONB column.
//
// The Admin/DB task may add a `details` jsonb column to `products` with shape:
// {
//   highlights?: string[];
//   specifications?: { group: string; items: { key: string; value: string }[] }[];
//   packageContents?: string[];
//   delivery?: string;
//   warranty?: string;
//   returns?: string;
// }
//
// This module normalizes *any* runtime value (null, string, array, malformed
// object, wrong types) into a well-typed structure and never throws. It also
// sanitizes every user/admin-provided string so that it can be rendered as
// plain text/safe React nodes (no dangerouslySetInnerHTML anywhere).

export interface SpecItem {
  key: string;
  value: string;
}

export interface SpecGroup {
  group: string;
  items: SpecItem[];
}

export interface ProductDetails {
  highlights: string[];
  specifications: SpecGroup[];
  packageContents: string[];
  delivery: string | null;
  warranty: string | null;
  returns: string | null;
}

const maxLength = 500;

function asSafeString(value: unknown, fallback: string | null = null): string | null {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const item of value) {
    const s = asSafeString(item);
    if (s) result.push(s);
  }
  return result;
}

function asSpecItems(value: unknown): SpecItem[] {
  if (!Array.isArray(value)) return [];
  const result: SpecItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const key = asSafeString(row.key);
    const val = asSafeString(row.value);
    if (key && val) result.push({ key, value: val });
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

  if (!value || typeof value !== 'object' || Array.isArray(value)) return empty;

  const raw = value as Record<string, unknown>;

  const specifications: SpecGroup[] = [];
  if (Array.isArray(raw.specifications)) {
    for (const groupRaw of raw.specifications) {
      if (!groupRaw || typeof groupRaw !== 'object') continue;
      const g = groupRaw as Record<string, unknown>;
      const groupName = asSafeString(g.group, '');
      const items = asSpecItems(g.items);
      if (items.length > 0) {
        specifications.push({ group: groupName ?? '', items });
      }
    }
  }

  return {
    highlights: asStringArray(raw.highlights),
    specifications,
    packageContents: asStringArray(raw.packageContents),
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
