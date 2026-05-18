import { useParams, Link } from 'react-router-dom'

export function BoardPage() {
  const { projectSlug, boardSlug } = useParams()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-900 gap-3">
      <p className="font-mono text-xs text-surface-200/40">
        {projectSlug} / {boardSlug}
      </p>
      <h2 className="font-display text-xl font-700 text-surface-50">Board View</h2>
      <p className="text-xs text-surface-200/30">Coming in Etap 4</p>
      <Link to="/projects" className="btn-ghost text-xs mt-2">
        ← Back to projects
      </Link>
    </div>
  )
}
