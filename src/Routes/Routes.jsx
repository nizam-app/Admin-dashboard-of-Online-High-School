import { createBrowserRouter } from 'react-router';
import DashboardLayout from '../layouts/DashboardLayout/DashboardLayout';
import DashboardPage from '../features/dashboard/pages/DashboardPage';
import UserManagementPage from '../features/users/pages/UserManagementPage';
import LoginPage from '../features/auth/pages/LoginPage';
import RegisterPage from '../features/auth/pages/RegisterPage';
import RequireAuth from '../features/auth/components/RequireAuth';
import GuestOnly from '../features/auth/components/GuestOnly';

export const router = createBrowserRouter([
  {
    Component: GuestOnly,
    children: [
      {
        path: '/auth/login',
        Component: LoginPage,
      },
      {
        path: '/auth/register',
        Component: RegisterPage,
      },
    ],
  },
  {
    Component: RequireAuth,
    children: [
      {
        path: '/',
        Component: DashboardLayout,
        children: [
          {
            index: true,
            Component: DashboardPage,
          },
          {
            path: 'users',
            Component: UserManagementPage,
          },
        ],
      },
    ],
  },
]);
