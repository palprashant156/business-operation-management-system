import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../features/auth/AuthContext';
import { RequireAuth } from './RequireAuth';
import { Shell } from '../layouts/Shell';
import { Login } from '../pages/Login';
import { Register } from '../pages/Register';
import { Dashboard } from '../pages/Dashboard';
import { Users } from '../pages/Users';
import { Employees } from '../pages/Employees';
import { Customers } from '../pages/Customers';
import { Products } from '../pages/Products';
import { Projects } from '../pages/Projects';
import { ProjectDetail } from '../pages/ProjectDetail';
import { Tasks } from '../pages/Tasks';
import { Orders } from '../pages/Orders';
import { Reports } from '../pages/Reports';
import { Notifications } from '../pages/Notifications';

function Guarded({ el, roles }: { el: JSX.Element; roles?: ('ADMIN' | 'MANAGER' | 'EMPLOYEE')[] }): JSX.Element {
  return (
    <RequireAuth roles={roles}>
      <Shell>{el}</Shell>
    </RequireAuth>
  );
}

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<Guarded el={<Dashboard />} />} />
          <Route path="/users" element={<Guarded el={<Users />} roles={['ADMIN']} />} />
          <Route path="/employees" element={<Guarded el={<Employees />} roles={['ADMIN', 'MANAGER']} />} />
          <Route path="/customers" element={<Guarded el={<Customers />} />} />
          <Route path="/products" element={<Guarded el={<Products />} />} />
          <Route path="/projects" element={<Guarded el={<Projects />} />} />
          <Route path="/projects/:id" element={<Guarded el={<ProjectDetail />} />} />
          <Route path="/tasks" element={<Guarded el={<Tasks />} />} />
          <Route path="/orders" element={<Guarded el={<Orders />} roles={['ADMIN', 'MANAGER']} />} />
          <Route path="/reports" element={<Guarded el={<Reports />} />} />
          <Route path="/notifications" element={<Guarded el={<Notifications />} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
