import type { GitHubStorage } from './GitHubStorage'
import type { Project } from './types'
import { slugify, generateId } from './utils'

export class ProjectService {
  constructor(private storage: GitHubStorage) {}

  // ─── List ──────────────────────────────────────────────────────────────────

  async listProjects(includeArchived = false): Promise<Project[]> {
    const dirs = await this.storage.listFiles('projects')
    const results = await Promise.allSettled(
      dirs
        .filter(d => d.type === 'dir' && !d.name.startsWith('.'))
        .map(d => this.storage.readJSON<Project>(`${d.path}/project.json`)),
    )

    return results
      .filter((r): r is PromiseFulfilledResult<{ data: Project; sha: string } | null> =>
        r.status === 'fulfilled' && r.value !== null,
      )
      .map(r => r.value!.data)
      .filter(p => includeArchived || !p.archived)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }

  // ─── Get ───────────────────────────────────────────────────────────────────

  async getProject(slug: string): Promise<{ data: Project; sha: string } | null> {
    return this.storage.readJSON<Project>(`projects/${slug}/project.json`)
  }

  // ─── Create ────────────────────────────────────────────────────────────────

  async createProject(
    params: Pick<Project, 'name' | 'description' | 'color' | 'emoji'>,
    createdBy: string,
  ): Promise<Project> {
    const slug    = slugify(params.name)
    const project: Project = {
      ...params,
      id:         generateId(),
      slug,
      created_by: createdBy,
      created_at: new Date().toISOString(),
      archived:   false,
    }

    // GitHub creates all parent directories automatically when writing a file.
    // No need to create `boards/` separately — listFiles returns [] for missing dirs.
    await this.storage.writeJSON(
      `projects/${slug}/project.json`,
      project,
      undefined,
      `feat: create project "${params.name}"`,
    )

    return project
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  async updateProject(
    slug: string,
    updates: Partial<Pick<Project, 'name' | 'description' | 'color' | 'emoji'>>,
  ): Promise<void> {
    const existing = await this.getProject(slug)
    if (!existing) throw new Error(`Project "${slug}" not found`)

    await this.storage.writeJSON(
      `projects/${slug}/project.json`,
      { ...existing.data, ...updates },
      existing.sha,
      `feat: update project "${slug}"`,
    )
  }

  // ─── Archive / Restore ─────────────────────────────────────────────────────

  async setArchived(slug: string, archived: boolean): Promise<void> {
    const existing = await this.getProject(slug)
    if (!existing) throw new Error(`Project "${slug}" not found`)

    await this.storage.writeJSON(
      `projects/${slug}/project.json`,
      { ...existing.data, archived },
      existing.sha,
      `${archived ? 'chore: archive' : 'chore: restore'} project "${slug}"`,
    )
  }
}
