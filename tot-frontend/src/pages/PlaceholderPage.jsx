export default function PlaceholderPage({ title }) {
  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">{title}</h1>
        <p className="page__lead">Coming in a later slice.</p>
      </header>
    </section>
  )
}
