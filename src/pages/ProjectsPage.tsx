import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { CreateProjectModal } from '../components/CreateProjectModal'
import { formatRelativeTime } from '../lib/utils'
import type { Project } from '../lib/types'

export function ProjectsPage() {
  const { user, projects: projectsSvc } = useAuth()
  const navigate = useNavigate()

  const [projects,     setProjects]     = useState<Project[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [createOpen,   setCreateOpen]   = useState(false)
  const [editProject,  setEditProject]  = useState<Project | null>(null)
  const [menuOpen,     setMenuOpen]     = useState<string | null>(null)
  const [archiving,    setArchiving]    = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!projectsSvc) return
    setLoading(true)
    try { setProjects(await projectsSvc.listProjects(showArchived)) }
    finally { setLoading(false) }
  }, [projectsSvc, showArchived]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  // ── Optimistic create ──────────────────────────────────────────────────────
  const handleCreate = async (data: Pick<Project, 'name' | 'description' | 'color' | 'emoji'>) => {
    if (!user) return
    const newProject = await projectsSvc.createProject(data, user.github_login)
    setProjects(prev => [newProject, ...prev])   // ← instant update, no re-fetch
  }

  // ── Optimistic edit ────────────────────────────────────────────────────────
  const handleEdit = async (data: Pick<Project, 'name' | 'description' | 'color' | 'emoji'>) => {
    if (!editProject) return
    await projectsSvc.updateProject(editProject.slug, data)
    setProjects(prev => prev.map(p =>
      p.slug === editProject.slug ? { ...p, ...data } : p
    ))
    setEditProject(null)
  }

  // ── Optimistic archive / restore ──────────────────────────────────────────
  const handleArchive = async (project: Project) => {
    setArchiving(project.slug)
    try {
      await projectsSvc.setArchived(project.slug, !project.archived)
      if (!showArchived) {
        // Remove from list when archiving (archived ones are hidden)
        setProjects(prev => prev.filter(p => p.slug !== project.slug))
      } else {
        setProjects(prev => prev.map(p =>
          p.slug === project.slug ? { ...p, archived: !p.archived } : p
        ))
      }
    } finally {
      setArchiving(null)
      setMenuOpen(null)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
        <div>
          <h1 className="font-display text-lg font-bold text-surface-50">Projects</h1>
          <p className="text-xs text-surface-200/40 mt-0.5">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived(v => !v)}
            className={`btn-ghost text-xs ${showArchived ? 'text-brand-400' : ''}`}
          >
            {showArchived ? 'Hide archived' : 'Show archived'}
          </button>
          <button onClick={() => setCreateOpen(true)} className="btn-primary">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            New project
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card h-36 animate-pulse bg-surface-800/50" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState onNew={() => setCreateOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                menuOpen={menuOpen === project.id}
                archiving={archiving === project.slug}
                onOpen={() => navigate(`/projects/${project.slug}`)}
                onMenuToggle={() => setMenuOpen(menuOpen === project.id ? null : project.id)}
                onEdit={() => { setEditProject(project); setMenuOpen(null) }}
                onArchive={() => handleArchive(project)}
              />
            ))}
          </div>
        )}
      </div>

      <CreateProjectModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
      <CreateProjectModal
        open={!!editProject}
        onClose={() => setEditProject(null)}
        onSubmit={handleEdit}
        initial={editProject ?? undefined}
        title="Edit project"
      />
      {menuOpen && <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />}
    </div>
  )
}

// ─── ProjectCard ──────────────────────────────────────────────────────────────

interface CardProps {
  project:      Project
  menuOpen:     boolean
  archiving:    boolean
  onOpen:       () => void
  onMenuToggle: () => void
  onEdit:       () => void
  onArchive:    () => void
}

function ProjectCard({ project, menuOpen, archiving, onOpen, onMenuToggle, onEdit, onArchive }: CardProps) {
  return (
    <div
      className={`card-hover group relative flex flex-col cursor-pointer overflow-hidden
                  ${project.archived ? 'opacity-50' : ''}`}
      onClick={onOpen}
    >
      <div className="h-1 w-full" style={{ backgroundColor: project.color }} />

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl leading-none flex-shrink-0">{project.emoji}</span>
            <div className="min-w-0">
              <h3 className="font-semibold text-surface-50 truncate">{project.name}</h3>
              {project.archived && (
                <span className="badge bg-surface-800 text-surface-200/40 text-[10px]">archived</span>
              )}
            </div>
          </div>

          <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={onMenuToggle}
              className="btn-ghost h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 z-20 w-40 rounded-2xl bg-surface-800
                              border border-white/5 shadow-modal py-1 animate-fade-in">
                <button onClick={onEdit}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-surface-200/70 hover:bg-white/5 hover:text-surface-50">
                  Edit
                </button>
                <button onClick={onArchive} disabled={archiving}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-surface-200/70 hover:bg-white/5 hover:text-surface-50">
                  {archiving ? 'Working…' : project.archived ? 'Restore' : 'Archive'}
                </button>
              </div>
            )}
          </div>
        </div>

        {project.description && (
          <p className="mt-2 text-xs text-surface-200/50 line-clamp-2">{project.description}</p>
        )}

        <div className="mt-auto pt-3 flex items-center justify-between">
          <span className="text-xs text-surface-200/30">{formatRelativeTime(project.created_at)}</span>
          <span className="text-xs text-surface-200/30">@{project.created_by}</span>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-800 ring-1 ring-white/5 text-3xl">📋</div>
      <div className="text-center">
        <p className="font-semibold text-surface-50">No projects yet</p>
        <p className="mt-1 text-sm text-surface-200/40">Create your first project to get started</p>
      </div>
      <button onClick={onNew} className="btn-primary mt-2">Create project</button>
    </div>
  )
}
