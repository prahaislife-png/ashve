import Link from "next/link";
import { languageOf, Units } from "@/lib/locale";

/**
 * The cm/inches and language switch at the top of a printed document
 * (PDF page, factory link). Plain links, so it works without JavaScript.
 */
export default function DocOptions({
  path,
  units,
  lang,
  languages,
}: {
  path: string;
  units: Units;
  lang: string;
  /** Language codes that have a translation (English is always there). */
  languages: string[];
}) {
  const href = (u: Units, l: string) => `${path}?units=${u}&lang=${l}`;
  const pill = (on: boolean) =>
    `rounded px-2.5 py-1 text-[12.5px] ${on ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-card hover:text-ink"}`;
  const langs = ["en", ...languages.filter((l) => l !== "en")];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-md bg-card/70 p-0.5" aria-label="Units">
        {(["cm", "in"] as const).map((u) => (
          <Link key={u} href={href(u, lang)} className={pill(units === u)} aria-current={units === u ? "true" : undefined}>
            {u === "cm" ? "cm" : "inches"}
          </Link>
        ))}
      </div>
      {langs.length > 1 && (
        <div className="flex flex-wrap rounded-md bg-card/70 p-0.5" aria-label="Language">
          {langs.map((l) => (
            <Link key={l} href={href(units, l)} className={pill(lang === l)} aria-current={lang === l ? "true" : undefined}>
              {languageOf(l).native}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
