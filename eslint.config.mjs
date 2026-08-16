import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Rule 1 — logical properties only.
 *
 * Physical direction utilities silently break RTL. Matches a banned utility
 * anywhere in a class string, allowing for variant prefixes (`md:ml-4`) and
 * negative values (`-ml-4`). `rounded-l`/`border-l` are matched only when the
 * `l`/`r` ends the token, so `rounded-lg` stays legal.
 */
const PHYSICAL_DIRECTION_CLASS =
  /(?:^|\s|:)-?(?:m[lr]|p[lr]|left|right)-|(?:^|\s|:)text-(?:left|right)(?=\s|$)|(?:^|\s|:)(?:border|rounded)-[lr](?=-|\s|$)/;

/**
 * Rule 4 — `tracking-*` must be `ltr:`-prefixed.
 *
 * Letter-spacing severs Arabic letter joins: the cursive connections come
 * apart and a word renders as loose disconnected glyphs. It is not a subtle
 * degradation, and it is invisible to anyone reviewing in English.
 */
// `ltr:` must appear somewhere in the variant chain, in any position —
// `ltr:tracking-tight` and `md:ltr:tracking-wide` are both fine.
const UNPREFIXED_TRACKING_CLASS = /(?:^|\s)(?:(?!ltr:)[a-z0-9-]+:)*tracking-/;

const TRACKING_MESSAGE =
  "Unprefixed tracking-* utility. Letter-spacing breaks Arabic letter joins — write it as ltr:tracking-* so it only applies in the English layout.";

const LOGICAL_PROPERTY_MESSAGE =
  "Physical direction utility. Use the logical equivalent: ms-/me- (ml-/mr-), ps-/pe- (pl-/pr-), start-/end- (left-/right-), text-start/text-end, border-s/border-e, rounded-s/rounded-e.";

/**
 * Class strings live in two places: a `className` attribute, and the `cva()` /
 * `cn()` calls that shadcn primitives are built from. Checking only the
 * attribute misses the second — which is where the components that every page
 * reuses keep theirs.
 */
const CLASS_STRING_HOSTS = [
  'JSXAttribute[name.name="className"]',
  'CallExpression[callee.name=/^(cva|cn|clsx|twMerge)$/]',
];

const classNameSelectors = CLASS_STRING_HOSTS.flatMap((host) => [
  {
    selector: `${host} Literal[value=${PHYSICAL_DIRECTION_CLASS}]`,
    message: LOGICAL_PROPERTY_MESSAGE,
  },
  {
    selector: `${host} TemplateElement[value.raw=${PHYSICAL_DIRECTION_CLASS}]`,
    message: LOGICAL_PROPERTY_MESSAGE,
  },
  {
    selector: `${host} Literal[value=${UNPREFIXED_TRACKING_CLASS}]`,
    message: TRACKING_MESSAGE,
  },
  {
    selector: `${host} TemplateElement[value.raw=${UNPREFIXED_TRACKING_CLASS}]`,
    message: TRACKING_MESSAGE,
  },
]);

/**
 * Rule 2 — no bare locale formatting.
 *
 * `toLocaleDateString('ar')` emits a Hijri date in Arabic-Indic digits.
 * `src/lib/format.ts` is the one place allowed to touch Intl, and it forces
 * `ar-SA-u-ca-gregory-nu-latn`.
 */
const LOCALE_FORMAT_MESSAGE =
  "Bare locale formatting. Import from @/lib/format instead — it forces ar-SA-u-ca-gregory-nu-latn (Gregorian calendar, Latin numerals) in both locales.";

const localeFormattingSelectors = [
  {
    selector:
      "CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/]",
    message: LOCALE_FORMAT_MESSAGE,
  },
  {
    selector: "NewExpression[callee.object.name='Intl']",
    message: LOCALE_FORMAT_MESSAGE,
  },
];

/**
 * Rule 5 — locale-aware navigation only.
 *
 * A bare `next/link` drops the locale prefix, so an Arabic reader who clicks it
 * silently lands in English. The same goes for `redirect`, `useRouter` and
 * `usePathname` from `next/navigation`.
 *
 * `useSearchParams`, `useParams` and `notFound` have no locale-aware
 * counterpart and stay allowed — banning them would only teach people to write
 * eslint-disable comments next to the ones that matter.
 */
const LOCALE_AWARE_NAVIGATION_PATHS = [
  {
    name: "next/link",
    message:
      "Import { Link } from '@/i18n/navigation' — next/link drops the locale prefix.",
  },
  {
    name: "next/navigation",
    importNames: ["redirect", "permanentRedirect", "useRouter", "usePathname"],
    message:
      "Import these from '@/i18n/navigation' — the next/navigation versions are not locale-aware. useSearchParams, useParams and notFound are fine from here.",
  },
];

/**
 * Rule 6 — one guarded database entry point.
 *
 * `src/lib/db/index.ts` carries `server-only`; `src/lib/db/client.ts` does not,
 * because the Better Auth CLI has to load `src/lib/auth.ts` outside React and
 * refuses any config that reaches `server-only`. That exemption is for
 * `auth.ts` alone — anywhere else, importing the raw client quietly drops the
 * guard that stops the connection pool being bundled into a client component.
 */
const GUARDED_DB_PATH = {
  name: "@/lib/db/client",
  message:
    "Import { db } from '@/lib/db'. The raw client skips the server-only guard and exists solely so the Better Auth CLI can load src/lib/auth.ts.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    /**
     * `src/lib/data/*.ts` takes the session as its first argument **without
     * exception**, including in the handful of functions that read genuinely
     * public data. The uniformity is the point: an exception is a thing to
     * remember, and ownership checks get missed at exactly the places someone
     * decided the rule didn't apply. Such a parameter is named `_session`.
     */
    name: "ajniha/unused-underscore-args",
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  {
    name: "ajniha/rtl-and-locale",
    rules: {
      "no-restricted-syntax": [
        "error",
        ...classNameSelectors,
        ...localeFormattingSelectors,
      ],
    },
  },

  {
    /**
     * The single sanctioned home for Intl — plus its own test, which has to
     * reach raw `Intl` to check the wrapper against it. A test that used the
     * wrapper to verify the wrapper would assert nothing.
     */
    name: "ajniha/format-exemption",
    files: ["src/lib/format.ts", "src/lib/format.test.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },

  /**
   * Rules 5 and 6 share the `no-restricted-imports` rule, and in flat config a
   * later block that names the same rule **replaces** the earlier one rather
   * than adding to it. So the paths are declared once above and each block
   * below re-states the full list it wants, minus its own exemption. Splitting
   * them into two blocks with one path each would have silently switched the
   * navigation ban back off everywhere.
   */
  {
    name: "ajniha/restricted-imports",
    ignores: ["src/i18n/**", "src/lib/auth.ts", "src/lib/db/index.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [...LOCALE_AWARE_NAVIGATION_PATHS, GUARDED_DB_PATH] },
      ],
    },
  },

  {
    // `src/i18n/` is where the locale-aware navigation primitives are built.
    name: "ajniha/restricted-imports-i18n",
    files: ["src/i18n/**"],
    rules: {
      "no-restricted-imports": ["error", { paths: [GUARDED_DB_PATH] }],
    },
  },

  {
    // The two files allowed to reach the unguarded pool.
    name: "ajniha/restricted-imports-db-entry",
    files: ["src/lib/auth.ts", "src/lib/db/index.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: LOCALE_AWARE_NAVIGATION_PATHS },
      ],
    },
  },

  {
    /**
     * Rule 3 — airspace purity.
     *
     * `src/lib/airspace/evaluate.ts` runs identically on the server
     * (authoritative) and in the browser map (instant feedback). The moment it
     * can reach the database or the request context, the map starts promising
     * what the server refuses. `query.ts` is the sanctioned db-facing edge.
     */
    name: "ajniha/airspace-purity",
    files: ["src/lib/airspace/**/*.ts"],
    ignores: ["src/lib/airspace/query.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/db",
              message:
                "The airspace engine stays pure — it runs in the browser too. Do database work in src/lib/airspace/query.ts and pass the result in.",
            },
            {
              name: "server-only",
              message:
                "The airspace engine stays pure — it must be importable by the map.",
            },
            {
              name: "next-intl",
              message:
                "The airspace engine returns machine-readable reason codes; translate them at render.",
            },
            {
              name: "react",
              message: "The airspace engine is plain TypeScript, not a component.",
            },
          ],
          patterns: [
            {
              group: ["@/lib/db/*", "next-intl/*", "react/*"],
              message:
                "The airspace engine stays pure — no db, no server-only, no next-intl, no react.",
            },
          ],
        },
      ],
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
