import { Link, useParams } from 'react-router-dom'

import { useThought } from '../hooks/useThought.js'
import { useThoughtMutations } from '../hooks/useThoughtMutations.js'
import { formatDateTime, formatRelativeTime } from '../lib/formatDate.js'

export default function ThoughtDetailPage() {
  const { id } = useParams()
  const { data: thought, isLoading, isError, error } = useThought(id)
  const { deleteThought, isDeleting, deleteError } = useThoughtMutations()

  const isNotFound =
    isError && error instanceof Error && error.status === 404

  function handleDelete() {
    if (!thought) {
      return
    }

    const confirmed = window.confirm(
      'Delete this thought? This cannot be undone.',
    )
    if (confirmed) {
      deleteThought(thought.id)
    }
  }

  return (
    <section className="page">
      <Link to="/" className="thought-detail__back">
        ← Back to thoughts
      </Link>

      {isLoading ? (
        <p className="thought-detail__status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          Loading thought…
        </p>
      ) : null}

      {isError && !isNotFound ? (
        <div className="alert alert--error" role="alert">
          {error instanceof Error ? error.message : 'Failed to load thought'}
        </div>
      ) : null}

      {isNotFound ? (
        <div className="empty-state">
          <p>Thought not found.</p>
          <p className="empty-state__actions">
            <Link to="/" className="btn btn-secondary">
              Back to thoughts
            </Link>
          </p>
        </div>
      ) : null}

      {thought ? (
        <article className="thought-detail">
          <header className="thought-detail__header">
            <h1 className="thought-detail__title">{thought.title}</h1>
            {thought.tags.length > 0 ? (
              <div className="thought-detail__tags">
                {thought.tags.map((tag) => (
                  <span key={tag} className="tag-chip">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="thought-detail__meta">
              <p>
                Created {formatDateTime(thought.created_at)} (
                {formatRelativeTime(thought.created_at)})
              </p>
              <p>
                Updated {formatDateTime(thought.updated_at)} (
                {formatRelativeTime(thought.updated_at)})
              </p>
            </div>
          </header>

          {thought.body ? (
            <div className="thought-detail__body">{thought.body}</div>
          ) : (
            <p className="thought-detail__empty-body">No body text.</p>
          )}

          <footer className="thought-detail__actions">
            <Link
              to={`/thoughts/${thought.id}/edit`}
              className="btn btn-primary"
            >
              Edit
            </Link>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </button>
            <Link to="/" className="btn btn-secondary">
              Back to list
            </Link>
          </footer>

          {deleteError ? (
            <p className="field-error" role="alert">
              {deleteError}
            </p>
          ) : null}
        </article>
      ) : null}
    </section>
  )
}
