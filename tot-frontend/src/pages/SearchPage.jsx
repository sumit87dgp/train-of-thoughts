import { useState } from 'react'

import ThoughtCard from '../components/ThoughtCard.jsx'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'
import { useSearchThoughts } from '../hooks/useSearchThoughts.js'

const PAGE_SIZE = 20

/** @param {{ query: string }} props */
function SearchResults({ query }) {
  const [offset, setOffset] = useState(0)
  const { data, isLoading, isError, error, isFetching } = useSearchThoughts(
    query,
    PAGE_SIZE,
    offset,
  )

  const items = data?.items ?? []
  const hasPrev = offset > 0
  const hasNext = items.length === PAGE_SIZE

  function goToPrevPage() {
    setOffset((current) => Math.max(0, current - PAGE_SIZE))
  }

  function goToNextPage() {
    setOffset((current) => current + PAGE_SIZE)
  }

  if (isLoading) {
    return (
      <p className="thought-list__status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        Searching…
      </p>
    )
  }

  if (isError) {
    return (
      <div className="alert alert--error" role="alert">
        {error instanceof Error ? error.message : 'Search failed'}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <p>No thoughts match &ldquo;{query}&rdquo;.</p>
      </div>
    )
  }

  return (
    <>
      <p className="search-page__summary" aria-live="polite">
        {items.length} result{items.length === 1 ? '' : 's'}
        {isFetching && !isLoading ? ' (updating…)' : ''}
      </p>

      <ul className="thought-list">
        {items.map((thought) => (
          <li key={thought.id}>
            <ThoughtCard thought={thought} />
          </li>
        ))}
      </ul>

      <nav
        className="thought-list__pagination"
        aria-label="Search results pagination"
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
  )
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 300)
  const trimmedQuery = query.trim()
  const trimmedDebounced = debouncedQuery.trim()
  const isDebouncing = trimmedQuery !== trimmedDebounced

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">Search</h1>
        <p className="page__lead">Find thoughts by title or body text.</p>
      </header>

      <div className="search-page__form">
        <label className="label" htmlFor="thought-search">
          Search thoughts
        </label>
        <input
          id="thought-search"
          className="input search-page__input"
          type="search"
          name="q"
          placeholder="Keywords…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
        />
      </div>

      {!trimmedQuery ? (
        <div className="empty-state">
          <p>Enter a keyword to search your thoughts.</p>
        </div>
      ) : null}

      {trimmedQuery && isDebouncing ? (
        <p className="thought-list__status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          Waiting for you to finish typing…
        </p>
      ) : null}

      {trimmedDebounced && trimmedQuery ? (
        <SearchResults key={trimmedDebounced} query={trimmedDebounced} />
      ) : null}
    </section>
  )
}
