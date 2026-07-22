import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Landing from './pages/Landing'
import HowItWorks from './pages/HowItWorks'
import SignUp from './pages/SignUp'
import Login from './pages/Login'
import ExpertDirectory from './pages/ExpertDirectory'
import ExpertProfile from './pages/ExpertProfile'
import ExpertDashboard from './pages/ExpertDashboard'
import OrganizationDashboard from './pages/OrganizationDashboard'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/experts" element={<ExpertDirectory />} />
        <Route path="/experts/:expertId" element={<ExpertProfile />} />
        <Route path="/dashboard" element={<ExpertDashboard />} />
        <Route path="/organization" element={<OrganizationDashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
    </>
  )
}
