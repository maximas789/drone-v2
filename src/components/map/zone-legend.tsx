import { getTranslations } from "next-intl/server";
import { DRAW_ORDER, ZONE_FILL } from "@/lib/maps/zone-palette";

/**
 * The key to the map.
 *
 * **The swatches read the same `--zone-*` tokens the map resolves**, through
 * `ZONE_FILL` — so a legend swatch and the polygon it explains cannot drift
 * apart. The map converts the token to hex through a canvas because MapLibre
 * cannot parse `oklch()`; the legend just uses the variable directly, and both
 * land on the same colour.
 *
 * The no-fly swatch carries the hatch as a CSS gradient rather than the
 * canvas-generated image the map uses. Two implementations of a texture is a
 * small duplication, but the alternative is exporting a data URI out of a
 * client component into a server one; and the point of the hatch — that the
 * three kinds are separable **without relying on hue** — is served either way.
 */
export async function ZoneLegend() {
  const t = await getTranslations("landing");

  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2">
      {DRAW_ORDER.map((kind) => (
        <li key={kind} className="flex items-center gap-2 text-sm">
          <span
            aria-hidden
            className="size-3 rounded-sm"
            style={
              kind === "no_fly"
                ? {
                    backgroundColor: ZONE_FILL[kind],
                    backgroundImage:
                      "repeating-linear-gradient(45deg, rgba(255,255,255,0.75) 0 1px, transparent 1px 4px)",
                  }
                : { backgroundColor: ZONE_FILL[kind] }
            }
          />
          <span>{t(`zoneKinds.${kind}`)}</span>
        </li>
      ))}
    </ul>
  );
}
