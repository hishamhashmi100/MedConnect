import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import { useAuth } from './context/AuthContext'
import AdminHome from './pages/admin/AdminHome'
import ForgotPassword from './pages/auth/ForgotPassword'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ResetPassword from './pages/auth/ResetPassword'
import VerifyOtp from './pages/auth/VerifyOtp'
import Availability from './pages/doctor/Availability'
import DoctorHome from './pages/doctor/DoctorHome'
import ProfileSetup from './pages/doctor/ProfileSetup'
import BookDoctor from './pages/patient/BookDoctor'
import Doctors from './pages/patient/Doctors'
import Home from './pages/patient/Home'
import MyAppointments from './pages/patient/MyAppointments'
import Reschedule from './pages/patient/Reschedule'
import { homePathFor } from './utils/format'

// Logged-in users are sent to their own home if they open a page meant for another role
function RequireRole({ role }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to={homePathFor(user.role)} replace />
  return <Outlet />
}

// Login and sign up pages make no sense once logged in
function GuestOnly() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to={homePathFor(user.role)} replace />
  return <Outlet />
}

function App() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>

      <Route element={<RequireRole role="patient" />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/doctors" element={<Doctors />} />
          <Route path="/doctors/:id/book" element={<BookDoctor />} />
          <Route path="/appointments" element={<MyAppointments />} />
          <Route path="/appointments/:id/reschedule" element={<Reschedule />} />
        </Route>
      </Route>

      <Route element={<RequireRole role="doctor" />}>
        <Route element={<AppLayout />}>
          <Route path="/doctor" element={<DoctorHome />} />
          <Route path="/doctor/profile" element={<ProfileSetup />} />
          <Route path="/doctor/availability" element={<Availability />} />
        </Route>
      </Route>

      <Route element={<RequireRole role="admin" />}>
        <Route element={<AppLayout />}>
          <Route path="/admin" element={<AdminHome />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
