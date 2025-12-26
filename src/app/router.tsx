import { createBrowserRouter, Navigate } from 'react-router-dom'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { AppLayout } from './AppLayout'
import { ProtectedRoute } from './ProtectedRoute'

import { WorkspaceSetupPage } from '@/features/workspace/pages/WorkspaceSetupPage'
import { TimelinePage } from '@/features/timeline/pages/TimelinePage'
import { StatsPage } from '@/features/stats/pages/StatsPage'
import { ExportPage } from '@/features/export/pages/ExportPage'

import { SettingsPage } from '@/features/workspace/pages/SettingsPage'

// Placeholder pages - will be implemented later

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/app',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/app/setup" replace />,
      },
      {
        path: 'setup',
        element: <WorkspaceSetupPage />,
      },
      {
        path: 'workspace/:workspaceId/baby/:babyId/timeline',
        element: <TimelinePage />,
      },
      {
        path: 'workspace/:workspaceId/baby/:babyId/stats',
        element: <StatsPage />,
      },
      {
        path: 'workspace/:workspaceId/baby/:babyId/export',
        element: <ExportPage />,
      },
      {
        path: 'workspace/:workspaceId/settings',
        element: <SettingsPage />,
      },
    ],
  },
])

