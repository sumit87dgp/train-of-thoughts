import { Link } from 'react-router-dom'

import { formatRelativeTime } from '../lib/formatDate.js'

/** @param {{ thought: import('../api/shapes.js').Thought }} props */
export default function ThoughtCard({ thought }) {
  return (
    <Link to={`/thoughts/${thought.id}`} className="thought-card">
      <h2 className="thought-card__title">{thought.title}</h2>
      {thought.body ? (
        <p className="thought-card__excerpt">{thought.body}</p>
      ) : null}
      {thought.tags.length > 0 ? (
        <div className="thought-card__tags">
          {thought.tags.map((tag) => (
            <span key={tag} className="tag-chip">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <div className="thought-card__meta">
        <time dateTime={thought.updated_at}>
          Updated {formatRelativeTime(thought.updated_at)}
        </time>
      </div>
    </Link>
  )
}
