import { notFound } from "next/navigation";
import { renderEmail } from "@/lib/email/render";
import {
  EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_NAMES,
  type EmailTemplateName,
} from "@/lib/email/templates";
import { emailConfigured } from "@/lib/email/config";
import { LOCALES, type Locale } from "@/lib/locale";

/**
 * Every template, in every locale, rendered exactly as it would be sent.
 *
 * This is how the Arabic layout gets checked without sending anything to
 * anyone — and, given that no check we run catches a rendering fault in an
 * email, it is the only place a human can see one.
 *
 * **Development only.** `NODE_ENV` is fixed at build time, so in a production
 * build this page prerenders as a 404 and there is no route to reach.
 *
 * Its own chrome is deliberately untranslated English and carries no message
 * keys: it is a tool for whoever is building the app, not a surface of it, and
 * putting dev-tool strings in the shipped catalogues would be a lie about what
 * the app has.
 */

export const metadata = { robots: { index: false, follow: false } };

type Preview = {
  name: EmailTemplateName;
  locale: Locale;
  subject: string;
  html: string;
  text: string;
};

export default async function EmailPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const previews: Preview[] = [];
  for (const name of EMAIL_TEMPLATE_NAMES) {
    for (const locale of LOCALES) {
      const rendered = await renderEmail(
        name,
        // The registry's own sample. Typed per template at the definition
        // site; here they are a heterogeneous list, hence the cast.
        EMAIL_TEMPLATES[name].sample as never,
        locale,
      );
      previews.push({ name, locale, ...rendered });
    }
  }

  return (
    <main dir="ltr" className="mx-auto flex max-w-6xl flex-col gap-10 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Email templates</h1>
        <p className="text-muted-foreground text-sm">
          {EMAIL_TEMPLATE_NAMES.length} templates × {LOCALES.length} locales,
          rendered by the same code that sends them. Development only.
        </p>
        <p className="text-muted-foreground text-sm">
          Sending is currently{" "}
          <strong>{emailConfigured ? "live" : "off"}</strong> —{" "}
          {emailConfigured
            ? "RESEND_API_KEY is set, so triggering one of these actually sends it."
            : "RESEND_API_KEY is empty, so a triggered email is printed to the terminal and logged as skipped."}
        </p>
      </header>

      {EMAIL_TEMPLATE_NAMES.map((name) => (
        <section key={name} className="flex flex-col gap-3">
          <h2 className="font-mono text-lg font-semibold">{name}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {previews
              .filter((preview) => preview.name === name)
              .map((preview) => (
                <figure
                  key={`${preview.name}-${preview.locale}`}
                  className="flex flex-col gap-2"
                >
                  <figcaption className="flex flex-col gap-1">
                    <span className="text-muted-foreground font-mono text-xs uppercase">
                      {preview.locale}
                    </span>
                    <span className="text-sm font-medium">
                      {preview.subject}
                    </span>
                  </figcaption>
                  <iframe
                    title={`${preview.name} (${preview.locale})`}
                    srcDoc={preview.html}
                    className="h-[640px] w-full rounded-lg border bg-white"
                  />
                  <details className="text-muted-foreground text-xs">
                    <summary className="cursor-pointer">Plain text</summary>
                    <pre className="mt-2 whitespace-pre-wrap">
                      {preview.text}
                    </pre>
                  </details>
                </figure>
              ))}
          </div>
        </section>
      ))}
    </main>
  );
}
