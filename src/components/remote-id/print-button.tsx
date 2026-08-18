"use client";

import { Button } from "@/components/ui/button";

/**
 * Opens the browser's own print dialog.
 *
 * **This is also how a pilot gets a file.** F19's "download the card as a
 * print-ready PNG" was cut: nothing installed can rasterise styled Arabic
 * server-side, and the candidates that could would shape it wrongly — satori
 * has no HarfBuzz, so the letters come out unjoined. The browser's print
 * pipeline already shapes Arabic correctly with the app's real fonts, and
 * "Save as PDF" in that dialog produces vector output, which prints better than
 * a raster card ever would.
 *
 * The label is passed in rather than translated here so this stays a control
 * with no opinion about the page it sits on.
 */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
