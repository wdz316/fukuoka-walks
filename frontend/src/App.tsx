import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import DestinationPage from './pages/DestinationPage'
import HistoryPage from './pages/HistoryPage'
import HomePage from './pages/HomePage'
import PlanPage from './pages/PlanPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="plan" element={<PlanPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="destination/:id" element={<DestinationPage />} />
      </Route>
    </Routes>
  )
}
