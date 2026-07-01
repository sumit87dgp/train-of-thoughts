import { Navigate, Route, Routes } from 'react-router-dom'

import Layout from './components/Layout.jsx'
import HealthPage from './pages/HealthPage.jsx'
import HomePage from './pages/HomePage.jsx'
import PlaceholderPage from './pages/PlaceholderPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="health" element={<HealthPage />} />
        <Route path="search" element={<PlaceholderPage title="Search" />} />
        <Route
          path="thoughts/new"
          element={<PlaceholderPage title="New thought" />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
