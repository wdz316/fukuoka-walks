import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import DestinationDetailPage from './pages/DestinationDetail'
import HistoryPage from './pages/History'
import DashboardPage from './pages/Dashboard'
import RecommendPage from './pages/Recommend'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="plan" element={<RecommendPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="destination/:id" element={<DestinationDetailPage />} />
      </Route>
    </Routes>
  )
}
