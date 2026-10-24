"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="panel"><h1>The kitchen hit a snag</h1><p>We couldn’t load this page. No additional operation was attempted.</p><button className="button" onClick={reset}>Try again</button></section>;
}
