import { useId, useState } from 'react'

import { useTags } from '../hooks/useTags.js'

/** @param {{ tags: string[], onChange: (tags: string[]) => void, disabled?: boolean }} props */
export default function TagInput({ tags, onChange, disabled = false }) {
  const inputId = useId()
  const listId = useId()
  const [input, setInput] = useState('')
  const { data } = useTags()

  const knownTags = data?.items.map((tag) => tag.name) ?? []
  const suggestions = knownTags
    .filter(
      (name) =>
        !tags.includes(name) &&
        name.toLowerCase().includes(input.trim().toLowerCase()),
    )
    .slice(0, 10)

  function addTag(raw) {
    const tag = raw.trim().replace(/,+$/, '')
    if (!tag || tags.includes(tag)) {
      return
    }
    onChange([...tags, tag])
    setInput('')
  }

  function removeTag(tagToRemove) {
    onChange(tags.filter((tag) => tag !== tagToRemove))
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag(input)
    } else if (event.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div className="tag-input">
      {tags.length > 0 ? (
        <div className="tag-list tag-input__chips">
          {tags.map((tag) => (
            <span key={tag} className="tag-chip tag-chip--selected">
              {tag}
              <button
                type="button"
                className="tag-input__remove"
                onClick={() => removeTag(tag)}
                disabled={disabled}
                aria-label={`Remove tag ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <input
        id={inputId}
        className="input"
        type="text"
        list={listId}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(input)}
        placeholder="Type a tag and press Enter"
        disabled={disabled}
        aria-describedby={`${inputId}-hint`}
      />
      <datalist id={listId}>
        {suggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <p id={`${inputId}-hint`} className="tag-input__hint">
        Press Enter or comma to add. Existing tags autocomplete.
      </p>
    </div>
  )
}
