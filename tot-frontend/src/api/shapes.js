/**
 * API response shapes (JSDoc only — no TypeScript compiler).
 * Mirrors tot-backend Pydantic schemas.
 */

/**
 * @typedef {Object} Thought
 * @property {string} id
 * @property {string} title
 * @property {string} body
 * @property {string} created_at ISO 8601 datetime
 * @property {string} updated_at ISO 8601 datetime
 * @property {string[]} tags
 */

/**
 * @typedef {Object} ThoughtCreate
 * @property {string} title
 * @property {string} [body]
 * @property {string[]} [tags]
 */

/**
 * @typedef {Object} ThoughtUpdate
 * @property {string} title
 * @property {string} [body]
 * @property {string[]} [tags]
 */

/**
 * @typedef {Object} ThoughtListResponse
 * @property {Thought[]} items
 * @property {number} limit
 * @property {number} offset
 */

/**
 * @typedef {Object} Tag
 * @property {string} id
 * @property {string} name
 */

/**
 * @typedef {Object} TagListResponse
 * @property {Tag[]} items
 */

export {}
