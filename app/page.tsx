export default function Home() {
  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <section className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-8 md:px-16">
        <p className="mb-4 text-sm uppercase tracking-[0.3em] text-stone-500">
          Theatre Photographer
        </p>

        <h1 className="max-w-4xl text-6xl font-light leading-tight md:text-8xl">
          Steve Gregson
        </h1>

        <p className="mt-8 max-w-2xl text-xl leading-relaxed text-stone-600">
          An evolving photographic archive documenting theatre, performance,
          and the artists who bring stories to life.
        </p>
      </section>
    </main>
  );
}