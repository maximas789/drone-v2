/**
 * The CSV writer for the analytics export.
 *
 * **Pure**, so the escaping rules can be tested rather than eyeballed in Excel,
 * and so the same function is reachable from the route handler without dragging
 * a database import into it.
 *
 * ---
 *
 * **The BOM is the whole feature.** Excel on Windows does not read a `.csv` as
 * UTF-8 unless the file opens with a byte-order mark: without it, `الثمامة`
 * arrives as `Ø§Ù„Ø«Ù…Ø§Ù…Ø©` — every Arabic zone name, closure reason and
 * pilot name in the export, mangled. The file is still valid UTF-8; the reader
 * simply guessed the code page. There is no way to fix it from inside the file
 * afterwards, and the person it breaks for is exactly the person this export is
 * for, so the BOM is written by `csvBody` itself rather than left to a caller
 * to remember.
 *
 * **CRLF line endings, for the same reader.** RFC 4180 specifies them and older
 * Excel builds treat a lone LF as no line break at all.
 */

export const UTF8_BOM = "﻿";

/**
 * One escaped field.
 *
 * Quoted whenever it contains a comma, a quote, a newline, or leading/trailing
 * whitespace — and quotes inside are doubled, which is CSV's own escape rather
 * than a backslash.
 *
 * **A leading `=`, `+`, `-` or `@` is prefixed with a tab.** A spreadsheet
 * reads such a cell as a *formula*, and a zone name or a rejection reason that
 * began with one would execute on open. Nothing in this app can currently
 * produce one, which is exactly why it would go unnoticed the day something
 * can: this export carries free text a member of the public typed.
 */
export function csvField(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `\t${value}` : value;
  return /[",\r\n]|^\s|\s$/.test(guarded)
    ? `"${guarded.replaceAll('"', '""')}"`
    : guarded;
}

export type CsvSection = {
  /** Printed on its own row above the table, so one file can hold seven charts. */
  readonly title: string;
  readonly head: readonly string[];
  readonly rows: readonly (readonly string[])[];
};

/**
 * The finished file, BOM included.
 *
 * One file with several titled sections rather than seven downloads: the export
 * is of *the current view*, and the current view is the whole page. A blank row
 * separates the sections, which is what a spreadsheet needs to keep them from
 * being read as one ragged table.
 */
export function csvBody(sections: readonly CsvSection[]): string {
  const lines: string[] = [];
  for (const section of sections) {
    if (lines.length > 0) lines.push("");
    lines.push(csvField(section.title));
    lines.push(section.head.map(csvField).join(","));
    for (const row of section.rows) lines.push(row.map(csvField).join(","));
  }
  return UTF8_BOM + lines.join("\r\n") + "\r\n";
}

/**
 * The download's filename. Latin only and no spaces — a `Content-Disposition`
 * header carrying Arabic needs RFC 5987 encoding, and a filename is not the
 * place this app's bilingualism has to be proved.
 */
export function csvFilename(range: string, day: string): string {
  return `ajniha-analytics-${range}-${day}.csv`;
}
