import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CONTACT, LEGAL_UPDATED, PAGES, legalPage } from "@/legal/content";

export function generateStaticParams() {
  return PAGES.map((p) => ({ page: p.slug }));
}

export function generateMetadata({ params }: { params: { page: string } }): Metadata {
  const doc = legalPage(params.page);
  return doc ? { title: doc.title, description: doc.intro } : {};
}

export default function LegalPageRoute({ params }: { params: { page: string } }) {
  const doc = legalPage(params.page);
  if (!doc) notFound();
  return (
    <main className="mx-auto max-w-2xl px-3 py-8 sm:px-4">
      <h1 className="text-2xl font-black">{doc.title}</h1>
      <p className="mt-1 text-xs text-neutral-500">TechBlob by Kavaro LLC. Last updated {LEGAL_UPDATED}.</p>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-neutral-300">
        <p>{doc.intro}</p>
        {doc.sections.map((s) => (
          <section key={s.title}>
            <h2 className="mb-1 text-base font-bold text-white">{s.title}</h2>
            {s.body.map((b, i) =>
              typeof b === "string" ? (
                <p key={i}>{b}</p>
              ) : (
                <ul key={i} className="list-disc space-y-1 pl-5">
                  {b.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )
            )}
          </section>
        ))}
        <p className="text-xs text-neutral-500">
          Contact: <a href={`mailto:${CONTACT}`} className="text-brand underline">{CONTACT}</a> ·{" "}
          {PAGES.map((p, i) => (
            <span key={p.slug}>
              {i ? " · " : ""}
              <Link href={`/legal/${p.slug}`} className="underline">{p.title}</Link>
            </span>
          ))}
        </p>
      </div>
    </main>
  );
}
