import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './auth.jsx'
import { ToastProvider } from './toast.jsx'
import AdminLayout from './components/AdminLayout.jsx'
import Voting from './pages/Voting.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Musharax from './pages/Musharax.jsx'
import VoteId from './pages/VoteId.jsx'
import Codbixiye from './pages/Codbixiye.jsx'
import ManageAdmin from './pages/ManageAdmin.jsx'
import Departments from './pages/Departments.jsx'
import NotFound from './pages/NotFound.jsx'
import Landing from './pages/Landing.jsx'

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/vote" element={<Voting />} />
          <Route path="/dashboard/login" element={<Login />} />
          <Route path="/dashboard" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="musharax" element={<Musharax />} />
            <Route path="voiteid" element={<VoteId />} />
            <Route path="codbixiye" element={<Codbixiye />} />
            <Route path="manageadmin" element={<ManageAdmin />} />
            <Route path="departments" element={<Departments />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}
