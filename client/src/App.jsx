import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import AdminLayout from './components/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import Candidates from './pages/admin/Candidates';
import Judges from './pages/admin/Judges';
import Rounds from './pages/admin/Rounds';
import Rankings from './pages/admin/Rankings';
import Reports from './pages/admin/Reports';
import AuditLogs from './pages/admin/AuditLogs';
import JudgeScoring from './pages/judge/Scoring';
import TabulatorMonitor from './pages/tabulator/Monitor';
import Display from './pages/display/Display';
import OfflineBanner from './components/OfflineBanner';

function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

export function homeFor(role) {
  return { admin: '/admin', judge: '/judge', tabulator: '/tabulator', display: '/display' }[role] || '/login';
}

export default function App() {
  const { user } = useAuth();
  return (
    <>
      <OfflineBanner />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/display" element={<Display />} />

        <Route path="/admin" element={<RequireRole roles={['admin']}><AdminLayout /></RequireRole>}>
          <Route index element={<Dashboard />} />
          <Route path="candidates" element={<Candidates />} />
          <Route path="judges" element={<Judges />} />
          <Route path="rounds" element={<Rounds />} />
          <Route path="rankings" element={<Rankings />} />
          <Route path="reports" element={<Reports />} />
          <Route path="audit" element={<AuditLogs />} />
        </Route>

        <Route path="/judge" element={<RequireRole roles={['judge']}><JudgeScoring /></RequireRole>} />

        <Route path="/tabulator" element={<RequireRole roles={['tabulator']}><AdminLayout tabulator /></RequireRole>}>
          <Route index element={<TabulatorMonitor />} />
          <Route path="rankings" element={<Rankings />} />
          <Route path="reports" element={<Reports />} />
          <Route path="audit" element={<AuditLogs />} />
        </Route>

        <Route path="*" element={<Navigate to={user ? homeFor(user.role) : '/login'} replace />} />
      </Routes>
    </>
  );
}
