import { describe, expect, it } from "vitest";
import { UTF8_BOM, csvBody, csvField, csvFilename } from "./csv";

describe("csvField", () => {
  it("leaves an ordinary field alone", () => {
    expect(csvField("Thumamah")).toBe("Thumamah");
    expect(csvField("الثمامة")).toBe("الثمامة");
  });

  it("quotes a field containing a comma", () => {
    expect(csvField("Riyadh, Saudi Arabia")).toBe('"Riyadh, Saudi Arabia"');
  });

  it("doubles an embedded quote rather than backslash-escaping it", () => {
    expect(csvField('he said "no"')).toBe('"he said ""no"""');
  });

  it("quotes a field containing a newline", () => {
    expect(csvField("line one\nline two")).toBe('"line one\nline two"');
  });

  it("quotes a field with leading or trailing whitespace so it survives", () => {
    expect(csvField(" padded ")).toBe('" padded "');
  });

  it("defuses a field a spreadsheet would run as a formula", () => {
    // Nothing in the app can produce one today. The export carries free text a
    // member of the public typed, so the day something can, this is why it did
    // not execute on open.
    expect(csvField("=1+1")).toBe('"\t=1+1"');
    expect(csvField("@SUM(A1)")).toBe('"\t@SUM(A1)"');
    expect(csvField("-2")).toBe('"\t-2"');
    expect(csvField("+1")).toBe('"\t+1"');
  });

  it("does not defuse a minus in the middle of a field", () => {
    expect(csvField("2026-08-21")).toBe("2026-08-21");
  });
});

describe("csvBody", () => {
  it("opens with a byte-order mark", () => {
    // Without it Excel on Windows reads الثمامة as Ø§Ù„Ø«Ù…Ø§Ù…Ø©, and there
    // is no fixing it from inside the file afterwards.
    const body = csvBody([{ title: "t", head: ["a"], rows: [["1"]] }]);
    expect(body.startsWith(UTF8_BOM)).toBe(true);
    expect(body.codePointAt(0)).toBe(0xfeff);
  });

  it("uses CRLF line endings", () => {
    const body = csvBody([{ title: "t", head: ["a", "b"], rows: [["1", "2"]] }]);
    expect(body).toBe(`${UTF8_BOM}t\r\na,b\r\n1,2\r\n`);
  });

  it("separates sections with a blank row", () => {
    const body = csvBody([
      { title: "one", head: ["a"], rows: [["1"]] },
      { title: "two", head: ["b"], rows: [["2"]] },
    ]);
    expect(body).toBe(`${UTF8_BOM}one\r\na\r\n1\r\n\r\ntwo\r\nb\r\n2\r\n`);
  });

  it("keeps Arabic intact, unescaped and unquoted", () => {
    const body = csvBody([
      { title: "الحجوزات", head: ["المنطقة"], rows: [["الثمامة"]] },
    ]);
    expect(body).toContain("الثمامة");
    expect(body).not.toContain('"الثمامة"');
  });

  it("writes an empty section as its heading, not as nothing", () => {
    const body = csvBody([{ title: "empty", head: ["a"], rows: [] }]);
    expect(body).toBe(`${UTF8_BOM}empty\r\na\r\n`);
  });
});

describe("csvFilename", () => {
  it("is Latin and space-free, so Content-Disposition needs no RFC 5987", () => {
    const name = csvFilename("30", "2026-08-21");
    expect(name).toBe("ajniha-analytics-30-2026-08-21.csv");
    expect(name).toMatch(/^[A-Za-z0-9._-]+$/);
  });
});
