import { createBrowserRouter, Navigate } from 'react-router-dom'
import { LoginPage }    from './pages/LoginPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { BoardPage }    from './pages/BoardPage'
import { ProtectedRoute } from './components/ProtectedRoute'

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Navigate to="/projects" replace />,
    },
    {
      path: '/login',
      element: <LoginPage />,
    },
    {
      element: <ProtectedRoute />,
      children: [
        {
          path: '/projects',
          element: <ProjectsPage />,
        },
        {
          path: '/projects/:projectSlug/boards/:boardSlug',
          element: <BoardPage />,
        },
      ],
    },
    {
      path: '*',
      element: <Navigate to="/projects" replace />,
    },
  ],
  {
    basename: '/company-dashboard',
  },
)
