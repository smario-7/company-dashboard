import type { SupabaseCardService } from './SupabaseCardService'
import type { NotificationService } from './NotificationService'
import type { NotifyContext } from './trelloNotify'
import { notifyUsers } from './trelloNotify'

export class DueDateReminderService {
  constructor(
    private cards: SupabaseCardService,
    private notifications: NotificationService,
  ) {}

  async checkBoard(
    boardId: string,
    projectSlug: string,
    boardSlug: string,
    actorId: string | null,
  ): Promise<void> {
    const dueSoon = await this.cards.getCardsDueSoon(boardId, 1)

    for (const card of dueSoon) {
      if (!(await this.cards.needsDueReminder(card))) continue
      if (card.assignees.length === 0) continue

      const ctx: NotifyContext = {
        projectSlug,
        boardSlug,
        boardId,
        cardId:    card.id,
        cardTitle: card.title,
      }

      await notifyUsers(
        this.notifications,
        actorId,
        card.assignees,
        'due_date_reminder',
        ctx,
      )

      await this.cards.markDueReminderSent(card.id)
    }
  }
}
