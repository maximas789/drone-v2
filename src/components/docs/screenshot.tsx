import Image from "next/image";
import {
  SCREENSHOTS,
  screenshotSrc,
  type ScreenshotName,
} from "@/lib/docs/screenshots";

/**
 * A real screenshot of the real UI, with a caption.
 *
 * **`alt` and `caption` are separate props and both are required**, because
 * they are answering different questions. The caption says what the reader is
 * looking at and sits under the picture for everybody; the `alt` describes what
 * the picture *contains* for somebody who cannot see it. Reusing one string for
 * both gives a screen-reader user the caption twice and the content never.
 *
 * `sizes` is the reading column, not the viewport: these sit inside the docs
 * measure, so the browser must not fetch a 1440-wide variant for a 640-wide
 * slot. The intrinsic dimensions come from `SCREENSHOTS`, so the space is
 * reserved correctly and the page does not jump as the image arrives.
 *
 * **Every screenshot in these pages is in Arabic**, which is the primary
 * experience, and stays in Arabic on the English pages. A picture is evidence
 * of what the product looks like; retaking all of them in English would double
 * the maintenance for a reader who can see the shape of the screen either way,
 * and the caption — which *is* translated — says what it shows.
 */
export function Screenshot({
  name,
  alt,
  caption,
}: {
  name: ScreenshotName;
  alt: string;
  caption: string;
}) {
  const { width, height } = SCREENSHOTS[name];

  return (
    <figure className="flex flex-col gap-2">
      <Image
        src={screenshotSrc(name)}
        alt={alt}
        width={width}
        height={height}
        sizes="(min-width: 768px) 42rem, 100vw"
        className="bg-muted h-auto w-full rounded-lg border"
      />
      <figcaption className="text-muted-foreground text-xs">
        {caption}
      </figcaption>
    </figure>
  );
}
