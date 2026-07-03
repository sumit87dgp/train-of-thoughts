import { useState } from 'react'
import { Link } from 'react-router-dom'

import ThoughtCard from '../components/ThoughtCard.jsx'
import { useTags } from '../hooks/useTags.js'
import { useThoughts } from '../hooks/useThoughts.js'
import { cn } from '../lib/cn.js'

const PAGE_SIZE = 20

/** @param {{ tag: string | null }} props */
function ThoughtListResults({ tag }) {
  const [offset, setOffset] = useState(0)
  const { data, isLoading, isError, error } = useThoughts(
    PAGE_SIZE,
    offset,
    tag ?? undefined,
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
        Loading thoughts…
      </p>
    )
  }

  if (isError) {
    return (
      <div className="alert alert--error" role="alert">
        {error instanceof Error ? error.message : 'Failed to load thoughts'}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="empty-state">
        {tag ? (
          <p>
            No thoughts tagged with &ldquo;{tag}&rdquo;.
          </p>
        ) : (
          <p>No thoughts yet.</p>
        )}
        <p className="empty-state__actions">
          {tag ? (
            <Link to="/thoughts/new" className="btn btn-primary">
              New thought
            </Link>
          ) : (
            <Link to="/thoughts/new" className="btn btn-primary">
              Create your first thought
            </Link>
          )}
        </p>
      </div>
    )
  }

  return (
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
          {tag ? ` · tag: ${tag}` : ''}
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

export default function ThoughtListPage() {
  const [selectedTag, setSelectedTag] = useState(null)
  const { data: tagsData, isLoading: tagsLoading } = useTags()
  const tags = tagsData?.items ?? []

  function selectTag(tag) {
    setSelectedTag(tag)
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

      <div className="thought-list__filter">
        <span className="thought-list__filter-label" id="thought-tag-filter-label">
          Filter by tag
        </span>
        {tagsLoading ? (
          <p className="thought-list__filter-status">Loading tags…</p>
        ) : (
          <div
            className="tag-list"
            role="group"
            aria-labelledby="thought-tag-filter-label"
          >
            <button
              type="button"
              className={cn(
                'tag-chip tag-chip--button',
                selectedTag === null && 'tag-chip--selected',
              )}
              onClick={() => selectTag(null)}
              aria-pressed={selectedTag === null}
            >
              All
            </button>
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={cn(
                  'tag-chip tag-chip--button',
                  selectedTag === tag.name && 'tag-chip--selected',
                )}
                onClick={() => selectTag(tag.name)}
                aria-pressed={selectedTag === tag.name}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <ThoughtListResults
        key={selectedTag ?? 'all'}
        tag={selectedTag}
      />
    </section>
  )
}
