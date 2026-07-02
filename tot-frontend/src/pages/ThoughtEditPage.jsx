import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import ThoughtForm from '../components/ThoughtForm.jsx'
import { useThought } from '../hooks/useThought.js'
import { useThoughtMutations } from '../hooks/useThoughtMutations.js'

/** @param {{ isCreate: boolean, id?: string, thought?: import('../api/shapes.js').Thought }} props */
function ThoughtEditor({ isCreate, id, thought }) {
  const [title, setTitle] = useState(thought?.title ?? '')
  const [body, setBody] = useState(thought?.body ?? '')
  const [tags, setTags] = useState(thought?.tags ?? [])

  const {
    createThought,
    updateThought,
    isCreating,
    isUpdating,
    createError,
    updateError,
  } = useThoughtMutations()

  const isSubmitting = isCreating || isUpdating
  const submitError = isCreate ? createError : updateError

  function handleSubmit(event) {
    event.preventDefault()
    const payload = {
      title: title.trim(),
      body,
      tags,
    }

    if (isCreate) {
      createThought(payload)
    } else if (id) {
      updateThought(id, payload)
    }
  }

  return (
    <ThoughtForm
      title={title}
      body={body}
      tags={tags}
      onTitleChange={setTitle}
      onBodyChange={setBody}
      onTagsChange={setTags}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      error={submitError}
      submitLabel={isCreate ? 'Create thought' : 'Save changes'}
      cancelTo={isCreate ? '/' : `/thoughts/${id}`}
    />
  )
}

export default function ThoughtEditPage() {
  const { id } = useParams()
  const isCreate = id === undefined

  const { data: thought, isLoading, isError, error } = useThought(
    isCreate ? undefined : id,
  )

  const isNotFound =
    !isCreate && isError && error instanceof Error && error.status === 404

  return (
    <section className="page">
      <Link
        to={isCreate ? '/' : `/thoughts/${id}`}
        className="thought-detail__back"
      >
        ← {isCreate ? 'Back to thoughts' : 'Back to thought'}
      </Link>

      <header className="page__header">
        <h1 className="page__title">
          {isCreate ? 'New thought' : 'Edit thought'}
        </h1>
      </header>

      {!isCreate && isLoading ? (
        <p className="thought-detail__status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          Loading thought…
        </p>
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

      {!isCreate && isError && !isNotFound ? (
        <div className="alert alert--error" role="alert">
          {error instanceof Error ? error.message : 'Failed to load thought'}
        </div>
      ) : null}

      {isCreate ? <ThoughtEditor isCreate /> : null}

      {!isCreate && thought ? (
        <ThoughtEditor
          key={thought.id}
          isCreate={false}
          id={id}
          thought={thought}
        />
      ) : null}
    </section>
  )
}
