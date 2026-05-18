import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ProjectService } from '../lib/ProjectService'
import { BoardService } from '../lib/BoardService'
import { CreateBoardModal } from '../components/CreateBoardModal'
import { formatRelativeTime } from '../lib/utils'
import type { Project, Board } from '../lib/types'

export function ProjectBoardsPage() {
  const { projectSlug }  = useParams<{ projectSlug: string }>()
  const { user, storage } = useAuth()
  const navigate          = useNavigate()

  const [project,     setProject]     = useState<Project | null>(null)
  const [boards,      setBoards]      = useState<Board[]>([])
  const [loading,     setLoading]     = useState(true)
  const [createOpen,  setCreateOpen]  = useState(false)
  const [editBoard,   setEditBoard]   = useState<Board | null>(null)
  const [menuOpen,    setMenuOpen]    = useState<string | null>(null)
  const [archiving,   setArchiving]   = useState<string | null>(null)
  const [showArchived,setShowArchived]= useState(false)

  const projectSvc = storage ? new ProjectService(storage) : null
  const boardSvc   = storage ? new BoardService(storage)   : null

  const load = useCallback(async () => {
    if (!projectSvc || !boardSvc || !projectSlug) return
    setLoading(true)
    try {
      const [proj, bds] = await Promise.all([
        projectSvc.getProject(projectSlug),
        boardSvc.listBoards(projectSlug, showArchived),
      ])
      if (!proj) { navigate('/projects', { replace: true }); return }
      setProject(proj.data)
      setBoards(bds)
    } finally {
      setLoading(false)
    }
  }, [storage, projectSlug, showArchived]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const handleCreate = async (data: Pick<Board, 'name' | 'description'>) => {
    if (!boardSvc || !user || !projectSlug) return
    await boardSvc.createBoard(projectSlug, data, user.githubLogin)
    await load()
  }

  const handleEdit = async (data: Pick<Board, 'name' | 'description'>) => {
    if (!boardSvc || !editBoard || !projectSlug) return
    await boardSvc.updateBoard(projectSlug, editBoard.slug, data)
    setEditBoard(null)
    await load()
  }

  const handleArchive = async (board: Board) => {
    if (!boardSvc || !projectSlug) return
    setArchiving(board.slug)
    try {
      await boardSvc.setArchived(projectSlug, board.slug, !board.archived)
      await load()
    } finally {
      setArchiving(null)
      setMenuOpen(null)
    }
  }

  if (loading) return <PageLoader />
  if (!project) return null

  return (
    <div className="flex flex-col flex-1 min-h-0 animate-fade-in">
      {/* Header */}
      <div className="border-b border-white/5 px-6 py-4">
        <Link to="/projects" className="flex items-center gap-1 text-xs text-surface-200/40 hover:text-surface-200 mb-3 w-fit transition-colors">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Projects
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl text-2xl flex-shrink-0"
              style={{ backgroundColor: project.color + '20', border: `1px solid ${project.color}30` }}
            >
              {project.emoji}
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-surface-50">{project.name}</h1>
              {project.description && (
                <p className="text-xs text-surface-200/40 mt-0.5">{project.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
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
              New board
            </button>
          </div>
        </div>
      </div>

      {/* Boards grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {boards.length === 0 ? (
          <EmptyState onNew={() => setCreateOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map(board => (
              <BoardCard
                key={board.id}
                board={board}
                menuOpen={menuOpen === board.id}
                archiving={archiving === board.slug}
                onOpen={() => navigate(`/projects/${projectSlug}/boards/${board.slug}`)}
                onMenuToggle={() => setMenuOpen(menuOpen === board.id ? null : board.id)}
                onEdit={() => { setEditBoard(board); setMenuOpen(null) }}
                onArchive={() => handleArchive(board)}
              />
            ))}
          </div>
        )}
      </div>

      <CreateBoardModal open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={handleCreate} />
      <CreateBoardModal
        open={!!editBoard} onClose={() => setEditBoard(null)}
        onSubmit={handleEdit} initial={editBoard ?? undefined} title="Edit board"
      />
      {menuOpen && <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />}
    </div>
  )
}

// ─── BoardCard ────────────────────────────────────────────────────────────────

interface BoardCardProps {
  board:        Board
  menuOpen:     boolean
  archiving:    boolean
  onOpen:       () => void
  onMenuToggle: () => void
  onEdit:       () => void
  onArchive:    () => void
}

function BoardCard({ board, menuOpen, archiving, onOpen, onMenuToggle, onEdit, onArchive }: BoardCardProps) {
  return (
    <div
      className={`card-hover group relative flex flex-col cursor-pointer p-4
                  ${board.archived ? 'opacity-50' : ''}`}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-semibold text-surface-50 truncate">{board.name}</h3>

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
                {archiving ? 'Working…' : board.archived ? 'Restore' : 'Archive'}
              </button>
            </div>
          )}
        </div>
      </div>

      {board.description && (
        <p className="text-xs text-surface-200/40 mb-3 line-clamp-2">{board.description}</p>
      )}

      {/* Column pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {board.columns.slice(0, 4).map(col => (
          <span
            key={col.id}
            className="badge text-[10px]"
            style={{ backgroundColor: col.color + '20', color: col.color }}
          >
            {col.name}
          </span>
        ))}
        {board.columns.length > 4 && (
          <span className="badge bg-white/5 text-surface-200/40 text-[10px]">
            +{board.columns.length - 4}
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between">
        <span className="text-xs text-surface-200/30">{formatRelativeTime(board.created_at)}</span>
        {board.archived && <span className="badge bg-surface-800 text-surface-200/40 text-[10px]">archived</span>}
      </div>
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-800 ring-1 ring-white/5 text-3xl">🗂</div>
      <div className="text-center">
        <p className="font-semibold text-surface-50">No boards yet</p>
        <p className="mt-1 text-sm text-surface-200/40">Create your first board to start organising work</p>
      </div>
      <button onClick={onNew} className="btn-primary mt-2">Create board</button>
    </div>
  )
}

function PageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="h-6 w-6 animate-spin-slow rounded-full border-2 border-surface-800 border-t-brand-400" />
    </div>
  )
}
