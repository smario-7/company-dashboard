import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { CardComment } from '../lib/CommentService'
import type { NotifyContext } from '../lib/trelloNotify'
import { notifyUsers } from '../lib/trelloNotify'
import { formatRelativeTime } from '../lib/utils'

interface Props {
  cardId: string
  boardId: string
  assignees: string[]
  notifyCtx: NotifyContext | null
}

export function CardComments({ cardId, boardId, assignees, notifyCtx }: Props) {
  const { comments, activity, notifications, user } = useAuth()
  const [items, setItems]       = useState<CardComment[]>([])
  const [body, setBody]         = useState('')
  const [loading, setLoading]   = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      setItems(await comments.listForCard(cardId))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [cardId, comments])

  const submit = async () => {
    if (!user || !body.trim()) return
    setSubmitting(true)
    try {
      const comment = await comments.addComment(cardId, user.id, body)
      setItems(prev => [...prev, comment])
      setBody('')

      await activity.log(boardId, cardId, user.id, 'comment_added', {
        excerpt: comment.body.slice(0, 120),
      })

      if (notifyCtx) {
        const others = assignees.filter(l => l !== user.github_login)
        if (others.length > 0) {
          await notifyUsers(
            notifications,
            user.id,
            others,
            'comment_added',
            notifyCtx,
            { comment: comment.body.slice(0, 200) },
          )
        }
        if (comment.mentions.length > 0) {
          await notifyUsers(
            notifications,
            user.id,
            comment.mentions,
            'mentioned',
            notifyCtx,
            { comment: comment.body.slice(0, 200) },
          )
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3 border-t border-white/5 pt-4">
      <p className="text-xs font-medium text-surface-200/40">Comments</p>

      {loading ? (
        <p className="text-xs text-surface-200/30">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-surface-200/30 italic">No comments yet</p>
      ) : (
        <ul className="space-y-3 max-h-48 overflow-y-auto">
          {items.map(c => (
            <li key={c.id} className="flex gap-2">
              <img
                src={c.author?.avatar_url ?? `https://github.com/${c.author?.github_login}.png?size=32`}
                alt=""
                className="h-6 w-6 rounded-full flex-shrink-0 ring-1 ring-white/10"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-surface-200/50">
                  <span className="font-medium text-surface-100">
                    {c.author?.display_name ?? c.author?.github_login}
                  </span>
                  {' · '}
                  {formatRelativeTime(c.created_at)}
                </p>
                <p className="text-sm text-surface-50 whitespace-pre-wrap break-words mt-0.5">
                  {c.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Write a comment… Use @login to mention"
          rows={2}
          className="input resize-none text-sm w-full"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting || !body.trim()}
          className="btn-primary text-xs self-end py-1.5 px-3"
        >
          {submitting ? 'Sending…' : 'Add comment'}
        </button>
      </div>
    </div>
  )
}
