import HealthCheck from '../components/HealthCheck.jsx'

export default function HealthPage() {
  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">System health</h1>
        <p className="page__lead">
          API and dependency checks. More services can be added here later.
        </p>
      </header>
      <HealthCheck />
    </section>
  )
}
