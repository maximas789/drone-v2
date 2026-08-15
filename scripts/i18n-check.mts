/**
 * Fails the build when the two message catalogues drift apart.
 *
 * Arabic is authored first, so the failure mode this catches is real and
 * one-directional: a feature adds Arabic copy, the English is written later,
 * and in between the English UI silently falls back to a key name — or worse,
 * next-intl renders the raw path and nobody notices because nobody on the team
 * reads the English build.
 *
 * Also compares ICU placeholders per key: `{count}` in one catalogue and
 * `{total}` in the other type-checks fine and throws at render.
 *
 * Run with `pnpm i18n:check`; also wired into `pnpm lint`.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const messagesDir = join(here, "..", "messages");

type Catalogue = { [key: string]: string | Catalogue };

function load(locale: string): Catalogue {
  return JSON.parse(
    readFileSync(join(messagesDir, `${locale}.json`), "utf8"),
  ) as Catalogue;
}

/** `{"a": {"b": "x"}}` → `{"a.b": "x"}` */
function flatten(node: Catalogue, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out.set(path, value);
    } else {
      for (const [nested, nestedValue] of flatten(value, path)) {
        out.set(nested, nestedValue);
      }
    }
  }
  return out;
}

/**
 * Pulls `{name}` out of an ICU message, including the argument of a plural or
 * select block (`{count, plural, ...}`), while ignoring the category bodies.
 */
function placeholders(message: string): Set<string> {
  const found = new Set<string>();
  for (const match of message.matchAll(/\{\s*([A-Za-z0-9_]+)\s*(?:,|\})/g)) {
    found.add(match[1]);
  }
  return found;
}

const BASE = "ar";
const TARGET = "en";

const base = flatten(load(BASE));
const target = flatten(load(TARGET));

const missingInTarget = [...base.keys()].filter((key) => !target.has(key));
const missingInBase = [...target.keys()].filter((key) => !base.has(key));

const placeholderMismatches: string[] = [];
for (const [key, baseMessage] of base) {
  const targetMessage = target.get(key);
  if (targetMessage === undefined) continue;

  const expected = placeholders(baseMessage);
  const actual = placeholders(targetMessage);
  const onlyBase = [...expected].filter((name) => !actual.has(name));
  const onlyTarget = [...actual].filter((name) => !expected.has(name));

  if (onlyBase.length > 0 || onlyTarget.length > 0) {
    placeholderMismatches.push(
      `  ${key}\n` +
        (onlyBase.length ? `      only in ${BASE}: ${onlyBase.join(", ")}\n` : "") +
        (onlyTarget.length ? `      only in ${TARGET}: ${onlyTarget.join(", ")}\n` : ""),
    );
  }
}

let failed = false;

if (missingInTarget.length > 0) {
  failed = true;
  console.error(`\nMissing from messages/${TARGET}.json (${missingInTarget.length}):`);
  for (const key of missingInTarget) console.error(`  ${key}`);
}

if (missingInBase.length > 0) {
  failed = true;
  console.error(`\nMissing from messages/${BASE}.json (${missingInBase.length}):`);
  for (const key of missingInBase) console.error(`  ${key}`);
}

if (placeholderMismatches.length > 0) {
  failed = true;
  console.error(`\nICU placeholder mismatches (${placeholderMismatches.length}):`);
  for (const line of placeholderMismatches) console.error(line);
}

if (failed) {
  console.error("\ni18n:check failed.\n");
  process.exit(1);
}

console.log(`i18n:check passed — ${base.size} keys, ${BASE} and ${TARGET} in sync.`);
