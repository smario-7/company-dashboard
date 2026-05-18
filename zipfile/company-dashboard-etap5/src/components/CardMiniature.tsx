import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CardMeta, Label } from '../lib/types'

interface Props {
  card:        CardMeta
  labels:      Label[]            // board-level label definitions
  isDragging?: boolean
  onClick:     () => void
}

const PRIORITY_DOT: Record<string, string> = {
  high:   'bg-accent-red',
  medium: 'bg-accent-amber',
  low:    'bg-accent-cyan',
  none:   '',
}

export function CardMiniature({ card, labels, isDragging, onClick }: Props) {
  const cardLabels   = labels.filter(l => card.label_ids.includes(l.id))
  const checkedCount = card.checklist.filter(i => i.done).length
  const totalCount   = card.checklist.length
  const isOverdue    = card.due_date && new Date(card.due_date) < new Date() && !card.archived

  return (
    <div
      onClick={onClick}
      className={`group rounded-xl bg-surface-850 border border-white/5 p-3 cursor-pointer
                  shadow-card hover:shadow-card-hover hover:border-white/10 transition-all
                  ${isDragging ? 'opacity-50 rotate-1 scale-105' : ''}
                  ${card.archived ? 'opacity-40' : ''}`}
    >
      {/* Labels row */}
      {cardLabels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {cardLabels.map(l => (
            <span
              key={l.id}
              className="h-1.5 w-8 rounded-full flex-shrink-0"
              style={{ backgroundColor: l.color }}
              title={l.name}
            />
          ))}
        </div>
      )}

      {/* Title + priority */}
      <div className="flex items-start gap-2">
        {card.priority !== 'none' && (
          <span
            className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[card.priority]}`}
          />
        )}
        <p className="text-sm text-surface-50 leading-snug flex-1 min-w-0 break-words">
          {card.title}
        </p>
      </div>

      {/* Footer row: date + checklist + assignees */}
      {(card.due_date || totalCount > 0 || card.assignees.length > 0) && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {card.due_date && (
            <span className={`flex items-center gap-1 text-xs rounded-md px-1.5 py-0.5
                             ${isOverdue
                               ? 'bg-accent-red/15 text-accent-red'
                               : 'bg-white/5 text-surface-200/50'}`}>
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
              {formatDate(card.due_date)}
            </span>
          )}

          {totalCount > 0 && (
            <span className={`flex items-center gap-1 text-xs rounded-md px-1.5 py-0.5
                             ${checkedCount === totalCount
                               ? 'bg-accent-green/15 text-accent-green'
                               : 'bg-white/5 text-surface-200/50'}`}>
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              {checkedCount}/{totalCount}
            </span>
          )}

          {card.assignees.length > 0 && (
            <div className="flex -space-x-1 ml-auto">
              {card.assignees.slice(0, 3).map(login => (
                <img
                  key={login}
                  src={`https://github.com/${login}.png?size=32`}
                  alt={login}
                  title={`@${login}`}
                  className="h-5 w-5 rounded-full ring-1 ring-surface-850"
                />
              ))}
              {card.assignees.length > 3 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full
                                 bg-surface-800 ring-1 ring-surface-850 text-[9px] text-surface-200/50">
                  +{card.assignees.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Sortable wrapper — wraps CardMiniature with @dnd-kit sortable. */
export function SortableCard(props: Props & { id: string }) {
  const { id, ...rest } = props
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id, data: { type: 'card' } })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      <CardMiniature {...rest} isDragging={isDragging} />
    </div>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}
