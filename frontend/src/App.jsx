import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ChatWindow from './components/ChatWindow'
import { ChatProvider } from './context/ChatContext'
import Landing from './pages/Landing'
import HowItWorks from './pages/HowItWorks'
import SignUp from './pages/SignUp'
import Login from './pages/Login'
import VerifyEmail from './pages/VerifyEmail'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import ExpertDirectory from './pages/ExpertDirectory'
import ExpertProfile from './pages/ExpertProfile'
import ExpertDashboard from './pages/ExpertDashboard'
import OrganizationDashboard from './pages/OrganizationDashboard'
import AdminDashboard from './pages/AdminDashboard'
import EngagementDetail from './pages/EngagementDetail'
import NotFound from './pages/NotFound'

export default function App() {
  // The landing page renders its own footer section (styled to match its
  // v5 marketing palette) as part of its content -- the plain global
  // Footer would just duplicate it directly underneath.
  const isLanding = useLocation().pathname === '/'

  return (
    <ChatProvider>
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/experts" element={<ExpertDirectory />} />
        <Route path="/experts/:expertId" element={<ExpertProfile />} />
        <Route path="/dashboard" element={<ExpertDashboard />} />
        <Route path="/organization" element={<OrganizationDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/engagements/:id" element={<EngagementDetail />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {!isLanding && <Footer />}
      <ChatWindow />
    </ChatProvider>
  )
}
