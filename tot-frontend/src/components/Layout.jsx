import { NavLink, Outlet, Link } from 'react-router-dom'

import { cn } from '../lib/cn.js'

function navLinkClass({ isActive }) {
  return cn('app-nav__link', isActive && 'app-nav__link--active')
}

export default function Layout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <Link className="app-brand" to="/">
            Train of Thoughts
          </Link>
          <nav className="app-nav" aria-label="Main navigation">
            <NavLink to="/" end className={navLinkClass}>
              Home
            </NavLink>
            <NavLink to="/search" className={navLinkClass}>
              Search
            </NavLink>
            <NavLink to="/thoughts/new" className={navLinkClass}>
              New thought
            </NavLink>
            <NavLink to="/health" className={navLinkClass}>
              Health
            </NavLink>
          </nav>
          <div className="app-header__actions">
            <button type="button" className="btn btn-secondary">
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
