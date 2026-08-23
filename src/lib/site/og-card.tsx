import { OG, riyadhZonePaths } from "@/lib/site/og";

/**
 * The preview card's layout, shared by every `opengraph-image` route.
 *
 * **One card, parameterised — not one card copied.** F30's spec asks for a
 * variant on `/remote-id`, and two files drawing the same card is how the
 * wordmark ends up a different size on the page most likely to be shared into a
 * conversation about the concept. Only the headline and the notice differ.
 *
 * It returns JSX for **satori**, not for the DOM: no CSS cascade, no custom
 * properties, no font stack, a subset of flexbox, and every `div` with more
 * than one child needs an explicit `display: "flex"`. The colours are literal
 * hex from `OG` for the same reason — `var(--zone-permitted)` is a string
 * satori cannot parse and does not complain about.
 */
export function OgCard({
  wordmark,
  headline,
  notice,
  rtl,
  headlinePerLine,
  noticePerLine,
}: {
  wordmark: string;
  headline: string;
  notice: string;
  rtl: boolean;
  headlinePerLine: number;
  noticePerLine: number;
}) {
  const zones = riyadhZonePaths(520);

  return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: rtl ? "row-reverse" : "row",
          background: OG.background,
          color: OG.foreground,
          fontFamily: "Plex Arabic",
          // satori has no logical properties, so direction is expressed by the
          // flex axis above and by which side the border sits on below.
          borderBottom: `10px solid ${OG.primary}`,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 26,
            flex: 1,
            padding: "0 64px",
            textAlign: rtl ? "right" : "left",
            alignItems: rtl ? "flex-end" : "flex-start",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: rtl ? "row-reverse" : "row",
              alignItems: "baseline",
              gap: 18,
            }}
          >
            <div style={{ fontSize: 86, fontWeight: 600, lineHeight: 1 }}>
              {wordmark}
            </div>
            {/**
             * **Only beside the Arabic wordmark.** `common.appName` is already
             * "Ajniha" in English, so rendering the Latin form next to it gave
             * a card reading `Ajniha Ajniha`. Caught by looking at the PNG —
             * nothing else would ever have said so.
             */}
            {rtl ? (
              <div
                style={{
                  fontSize: 40,
                  fontWeight: 400,
                  color: OG.primary,
                  lineHeight: 1,
                }}
              >
                Ajniha
              </div>
            ) : null}
          </div>

          <Paragraph
            text={headline}
            perLine={headlinePerLine}
            rtl={rtl}
            style={{ fontSize: 30, lineHeight: 1.45, color: OG.foreground }}
          />

          <Paragraph
            text={notice}
            perLine={noticePerLine}
            rtl={rtl}
            style={{ fontSize: 20, lineHeight: 1.5, color: OG.muted }}
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 540,
            height: "100%",
            background: "#0c1319",
            borderInlineStart: `1px solid ${OG.border}`,
          }}
        >
          {zones ? (
            <svg
              width={520}
              height={Math.min(zones.height, 560)}
              viewBox={`0 0 ${zones.width} ${zones.height}`}
            >
              {zones.paths.map((path) => (
                <path
                  key={path.key}
                  d={path.d}
                  // `evenodd`, so a ring inside a ring is a hole — KKIA's
                  // no-fly ring is one, and painting it solid would be a
                  // different claim about the airspace.
                  fillRule="evenodd"
                  fill={path.colour}
                  fillOpacity={path.opacity}
                  stroke={path.colour}
                  strokeWidth={2}
                  strokeOpacity={0.95}
                />
              ))}
            </svg>
          ) : null}
        </div>
      </div>
  );
}

/**
 * A paragraph laid out **word by word, with a gap we choose.**
 *
 * satori spaces Arabic unevenly — gaps two and three times the width of a
 * normal space, in the middle of a sentence, which reads as a rendering fault
 * rather than as typography. The English card, drawn by the same code, is
 * clean, so it is the RTL path specifically. Two cheaper fixes were tried and
 * changed nothing: pre-breaking the lines so there is no slack to distribute,
 * and removing `display: flex` from the line boxes (byte-identical PNG).
 *
 * So the spaces are not satori's to draw. Each word becomes a flex item and the
 * space between them is an explicit `gap`, which is uniform by construction.
 * `row-reverse` puts the first word rightmost — reading order for Arabic —
 * **and shaping survives, because Arabic letters do not join across a space.**
 * A word is an independent shaping run, so laying words out separately changes
 * where they sit and not how they are drawn.
 *
 * Lines are broken by word count rather than measured, which is why `perLine`
 * differs per locale. **That is only safe because the strings are fixed**: both
 * come from the message catalogue and change when somebody edits them
 * deliberately, at which point they should look at the card. A user-supplied
 * string would need real measurement.
 */
function Paragraph({
  text,
  perLine,
  rtl,
  style,
}: {
  text: string;
  perLine: number;
  rtl: boolean;
  style: Record<string, string | number>;
}) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[][] = [];
  for (let i = 0; i < words.length; i += perLine) {
    lines.push(words.slice(i, i + perLine));
  }

  const fontSize = Number(style.fontSize) || 20;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: rtl ? "flex-end" : "flex-start",
        maxWidth: 580,
        ...style,
      }}
    >
      {lines.map((line, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            flexDirection: rtl ? "row-reverse" : "row",
            // A word space is about a quarter of the type size in this family.
            gap: Math.round(fontSize * 0.26),
          }}
        >
          {line.map((word, wordIndex) => (
            <div key={wordIndex}>{word}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
