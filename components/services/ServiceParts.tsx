import type { ReactNode } from "react";

import { SITE_URL } from "../directory/DirectoryParts";

/**
 * Highlights wording Steve has not yet confirmed (prices, turnaround and
 * similar). Every use must be replaced with real wording before the page
 * goes live.
 */
export function ToConfirm({ children }: { children: ReactNode }) {
  return <mark className="svc-confirm">{children}</mark>;
}

export type Question = {
  question: string;
  answer: ReactNode;
  /** Plain-text answer for search engines. Leave out while the answer still needs confirming. */
  answerText?: string;
};

export function Questions({ items }: { items: Question[] }) {
  return (
    <div className="svc-faq">
      {items.map((item) => (
        <details key={item.question}>
          <summary>{item.question}</summary>
          <div className="svc-faq-answer">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}

export function faqJsonLd(items: Question[], url: string) {
  const answered = items.filter((item) => item.answerText);
  if (answered.length === 0) return null;

  return {
    "@type": "FAQPage",
    "@id": `${SITE_URL}${url}#questions`,
    mainEntity: answered.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answerText },
    })),
  };
}

export function serviceJsonLd({
  url,
  name,
  serviceType,
  description,
}: {
  url: string;
  name: string;
  serviceType: string;
  description: string;
}) {
  return {
    "@type": "Service",
    "@id": `${SITE_URL}${url}#service`,
    name,
    serviceType,
    description,
    url: `${SITE_URL}${url}`,
    provider: { "@id": `${SITE_URL}/#steve-gregson` },
    areaServed: [
      { "@type": "City", name: "London" },
      { "@type": "Country", name: "United Kingdom" },
    ],
  };
}

export function listSentence(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
