import { supabase } from './supabase'
import type { Project } from './types'
import { projectFromRow, type ProjectRow } from './dbMappers'
import { slugify, generateId } from './utils'

export class SupabaseProjectService {
  async listProjects(includeArchived = false): Promise<Project[]> {
    let q = supabase.from('projects').select('*').order('created_at', { ascending: false })
    if (!includeArchived) q = q.eq('archived', false)
    const { data, error } = await q
    if (error) throw error
    return (data as ProjectRow[]).map(projectFromRow)
  }

  async getProject(slug: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
    if (error) throw error
    return data ? projectFromRow(data as ProjectRow) : null
  }

  async createProject(
    params: Pick<Project, 'name' | 'description' | 'color' | 'emoji'>,
    createdBy: string,
  ): Promise<Project> {
    const slug = slugify(params.name)
    const row: ProjectRow = {
      id: generateId(),
      slug,
      name: params.name,
      description: params.description,
      color: params.color,
      emoji: params.emoji,
      archived: false,
      created_by: createdBy,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('projects').insert(row)
    if (error) throw error
    return projectFromRow(row)
  }

  async updateProject(
    slug: string,
    updates: Partial<Pick<Project, 'name' | 'description' | 'color' | 'emoji'>>,
  ): Promise<void> {
    const { error } = await supabase.from('projects').update(updates).eq('slug', slug)
    if (error) throw error
  }

  async setArchived(slug: string, archived: boolean): Promise<void> {
    const { error } = await supabase.from('projects').update({ archived }).eq('slug', slug)
    if (error) throw error
  }
}
