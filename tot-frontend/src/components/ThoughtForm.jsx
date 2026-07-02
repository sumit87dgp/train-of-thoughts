import { Link } from 'react-router-dom'

import TagInput from './TagInput.jsx'

/**
 * @param {{
 *   title: string,
 *   body: string,
 *   tags: string[],
 *   onTitleChange: (value: string) => void,
 *   onBodyChange: (value: string) => void,
 *   onTagsChange: (tags: string[]) => void,
 *   onSubmit: (event: SubmitEvent) => void,
 *   isSubmitting?: boolean,
 *   error?: string | null,
 *   submitLabel?: string,
 *   cancelTo?: string,
 * }} props
 */
export default function ThoughtForm({
  title,
  body,
  tags,
  onTitleChange,
  onBodyChange,
  onTagsChange,
  onSubmit,
  isSubmitting = false,
  error = null,
  submitLabel = 'Save',
  cancelTo,
}) {
  return (
    <form className="thought-form" onSubmit={onSubmit}>
      <div className="field">
        <label className="label" htmlFor="thought-title">
          Title
        </label>
        <input
          id="thought-title"
          className="input"
          name="title"
          type="text"
          required
          maxLength={500}
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="thought-body">
          Body
        </label>
        <textarea
          id="thought-body"
          className="textarea"
          name="body"
          rows={8}
          value={body}
          onChange={(event) => onBodyChange(event.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div className="field">
        <span className="label" id="thought-tags-label">
          Tags
        </span>
        <div aria-labelledby="thought-tags-label">
          <TagInput
            tags={tags}
            onChange={onTagsChange}
            disabled={isSubmitting}
          />
        </div>
      </div>

      {error ? <p className="field-error">{error}</p> : null}

      <div className="thought-form__actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving…' : submitLabel}
        </button>
        {cancelTo ? (
          <Link to={cancelTo} className="btn btn-secondary">
            Cancel
          </Link>
        ) : null}
      </div>
    </form>
  )
}
