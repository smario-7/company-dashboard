import { supabase } from './supabase'
import type { NotificationService } from './NotificationService'
import type { NotificationType } from './types'

export interface NotifyContext {
  projectSlug: string
  boardSlug: string
  boardId: string
  cardId: string
  cardTitle: string
}

function basePayload(ctx: NotifyContext) {
  return {
    project:     ctx.projectSlug,
    board:       ctx.boardSlug,
    card_id:     ctx.cardId,
    card_title:  ctx.cardTitle,
  }
}

async function profileIdByGithubLogin(login: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id')
    .ilike('github_login', login)
    .maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

async function githubLoginByProfileId(id: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('github_login')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data?.github_login ?? null
}

export async function notifyUsers(
  notifications: NotificationService,
  actorId: string | null,
  recipientLogins: string[],
  type: NotificationType,
  ctx: NotifyContext,
  extra?: Record<string, unknown>,
): Promise<void> {
  const actorLogin = actorId ? await githubLoginByProfileId(actorId) : null
  const payload = { ...basePayload(ctx), ...extra }

  const unique = [...new Set(recipientLogins.map(l => l.toLowerCase()))]

  await Promise.all(
    unique.map(async login => {
      if (actorLogin && login.toLowerCase() === actorLogin.toLowerCase()) return
      const recipientId = await profileIdByGithubLogin(login)
      if (!recipientId) return
      await notifications.create(recipientId, type, actorId, payload)
    }),
  )
}
