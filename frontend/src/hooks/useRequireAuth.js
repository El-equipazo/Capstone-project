import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Every other page hardcodes its own literal `/login?next=/whatever` redirect
// (see ExpertDashboard.jsx, OrganizationDashboard.jsx) -- that works because
// their own path is a static string. EngagementDetail's redirect target is
// dynamic (`/engagements/:id`), which is real logic worth sharing rather than
// boilerplate worth duplicating a third time.
export function useRequireAuth() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`, { replace: true })
    }
  }, [user, location.pathname, navigate])

  return user
}
