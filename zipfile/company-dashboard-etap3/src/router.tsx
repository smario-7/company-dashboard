import { createBrowserRouter, Navigate } from 'react-router-dom'
import { LoginPage }           from './pages/LoginPage'
import { ProjectsPage }        from './pages/ProjectsPage'
import { ProjectBoardsPage }   from './pages/ProjectBoardsPage'
import { BoardPage }           from './pages/BoardPage'
import { ProfilePage }         from './pages/ProfilePage'
import { AdminPage }           from './pages/AdminPage'
import { ProtectedRoute }      from './components/ProtectedRoute'
import { AdminRoute }          from './components/AdminRoute'
import { Layout }              from './components/Layout'

export const router = createBrowserRouter(
  [
    { path: '/', element: <Navigate to="/projects" replace /> },
    { path: '/login', element: <LoginPage /> },
    {
      element: <ProtectedRoute />,
      children: [
        {
          element: <Layout />,
          children: [
            { path: '/projects',                                    element: <ProjectsPage /> },
            { path: '/projects/:projectSlug',                       element: <ProjectBoardsPage /> },
            { path: '/projects/:projectSlug/boards/:boardSlug',     element: <BoardPage /> },
            { path: '/profile',                                     element: <ProfilePage /> },
            {
              element: <AdminRoute />,
              children: [{ path: '/admin', element: <AdminPage /> }],
            },
          ],
        },
      ],
    },
    { path: '*', element: <Navigate to="/projects" replace /> },
  ],
  { basename: '/company-dashboard' },
)
