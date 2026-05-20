import { supabase } from './supabase'
import type { UserProfile } from './supabase'

export interface CardComment {
  id: string
  card_id: string
  author_id: string
  body: string
  mentions: string[]
  created_at: string
  updated_at: string | null
  author?: Pick<UserProfile, 'display_name' | 'avatar_url' | 'github_login'>
}

const MENTION_RE = /@([a-zA-Z0-9_-]+)/g

export function extractMentions(body: string): string[] {
  const found = new Set<string>()
  let m: RegExpExecArray | null
  const re = new RegExp(MENTION_RE.source, 'g')
  while ((m = re.exec(body)) !== null) {
    found.add(m[1].toLowerCase())
  }
  return [...found]
}

export class CommentService {
  async listForCard(cardId: string): Promise<CardComment[]> {
    const { data, error } = await supabase
      .from('card_comments')
      .select('id, card_id, author_id, body, mentions, created_at, updated_at')
      .eq('card_id', cardId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return this.attachAuthors((data ?? []) as CardComment[])
  }

  async addComment(
    cardId: string,
    authorId: string,
    body: string,
  ): Promise<CardComment> {
    const trimmed = body.trim()
    if (!trimmed) throw new Error('Comment cannot be empty')

    const mentions = extractMentions(trimmed)

    const { data, error } = await supabase
      .from('card_comments')
      .insert({ card_id: cardId, author_id: authorId, body: trimmed, mentions })
      .select('id, card_id, author_id, body, mentions, created_at, updated_at')
      .single()
    if (error) throw error
    const [withAuthor] = await this.attachAuthors([data as CardComment])
    return withAuthor
  }

  private async attachAuthors(comments: CardComment[]): Promise<CardComment[]> {
    if (comments.length === 0) return []
    const ids = [...new Set(comments.map(c => c.author_id))]
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('id, display_name, avatar_url, github_login')
      .in('id', ids)
    if (error) throw error
    const byId = new Map((profiles ?? []).map(p => [p.id, p]))
    return comments.map(c => ({
      ...c,
      author: byId.get(c.author_id) ?? undefined,
    }))
  }
}
