import { useState } from 'react'
import { Link } from 'react-router-dom'

import ThoughtCard from '../components/ThoughtCard.jsx'
import { useThoughts } from '../hooks/useThoughts.js'

const PAGE_SIZE = 20

export default function ThoughtListPage() {
  const [offset, setOffset] = useState(0)
  const { data, isLoading, isError, error } = useThoughts(PAGE_SIZE, offset)

  const items = data?.items ?? []
  const hasPrev = offset > 0
  const hasNext = items.length === PAGE_SIZE

  function goToPrevPage() {
    setOffset((current) => Math.max(0, current - PAGE_SIZE))
  }

  function goToNextPage() {
    setOffset((current) => current + PAGE_SIZE)
  }

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">Thoughts</h1>
        <p className="page__lead">Your ideas, projects, and notes.</p>
        <div className="page__actions">
          <Link to="/thoughts/new" className="btn btn-primary">
            New thought
          </Link>
          <Link to="/search" className="btn btn-secondary">
            Search
          </Link>
        </div>
      </header>

      {isLoading ? (
        <p className="thought-list__status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          Loading thoughts…
        </p>
      ) : null}

      {isError ? (
        <div className="alert alert--error" role="alert">
          {error instanceof Error ? error.message : 'Failed to load thoughts'}
        </div>
      ) : null}

      {!isLoading && !isError && items.length === 0 ? (
        <div className="empty-state">
          <p>No thoughts yet.</p>
          <p className="empty-state__actions">
            <Link to="/thoughts/new" className="btn btn-primary">
              Create your first thought
            </Link>
          </p>
        </div>
      ) : null}

      {!isLoading && !isError && items.length > 0 ? (
        <>
          <ul className="thought-list">
            {items.map((thought) => (
              <li key={thought.id}>
                <ThoughtCard thought={thought} />
              </li>
            ))}
          </ul>

          <nav
            className="thought-list__pagination"
            aria-label="Thought list pagination"
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={goToPrevPage}
              disabled={!hasPrev}
            >
              Previous
            </button>
            <span className="thought-list__page-info">
              Showing {offset + 1}–{offset + items.length}
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={goToNextPage}
              disabled={!hasNext}
            >
              Next
            </button>
          </nav>
        </>
      ) : null}
    </section>
  )
}
