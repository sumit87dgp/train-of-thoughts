import { Navigate, Route, Routes } from 'react-router-dom'

import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import HealthPage from './pages/HealthPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SearchPage from './pages/SearchPage.jsx'
import ThoughtDetailPage from './pages/ThoughtDetailPage.jsx'
import ThoughtEditPage from './pages/ThoughtEditPage.jsx'
import ThoughtListPage from './pages/ThoughtListPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ThoughtListPage />} />
        <Route path="health" element={<HealthPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="thoughts/new" element={<ThoughtEditPage />} />
        <Route path="thoughts/:id/edit" element={<ThoughtEditPage />} />
        <Route path="thoughts/:id" element={<ThoughtDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
