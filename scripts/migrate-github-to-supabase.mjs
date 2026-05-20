/**
 * One-time migration: GitHub projects/*.json → Supabase tables.
 *
 * Requires:
 *   GITHUB_TOKEN (repo read)
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)
 *
 * Usage: node scripts/migrate-github-to-supabase.mjs
 */

import { Octokit } from '@octokit/rest'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

function loadEnv() {
  const path = join(process.cwd(), '.env')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const k = t.slice(0, i).trim()
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnv()

const OWNER = process.env.VITE_GITHUB_OWNER
const REPO  = process.env.VITE_GITHUB_REPO
const GH    = process.env.GITHUB_TOKEN
const URL   = process.env.VITE_SUPABASE_URL
const KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!OWNER || !REPO || !GH || !URL || !KEY) {
  console.error('Missing env: VITE_GITHUB_OWNER, VITE_GITHUB_REPO, GITHUB_TOKEN, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const octokit = new Octokit({ auth: GH })
const supabase = createClient(URL, KEY)

async function readJson(path) {
  try {
    const { data } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path })
    if (Array.isArray(data) || data.type !== 'file') return null
    return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'))
  } catch {
    return null
  }
}

async function listDirs(path) {
  try {
    const { data } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path })
    if (!Array.isArray(data)) return []
    return data.filter(e => e.type === 'dir').map(e => e.name)
  } catch {
    return []
  }
}

const stats = { projects: 0, boards: 0, cards: 0, errors: [] }

async function migrate() {
  const projectSlugs = await listDirs('projects')
  console.log(`Found ${projectSlugs.length} project(s) on GitHub`)

  for (const slug of projectSlugs) {
    const project = await readJson(`projects/${slug}/project.json`)
    if (!project) {
      stats.errors.push(`Skip ${slug}: no project.json`)
      continue
    }

    const { error: pErr } = await supabase.from('projects').upsert({
      id:          project.id,
      slug:        project.slug ?? slug,
      name:        project.name,
      description: project.description ?? '',
      color:       project.color ?? '#3b82f6',
      emoji:       project.emoji ?? '📁',
      archived:    project.archived ?? false,
      created_by:  project.created_by,
      created_at:  project.created_at,
      updated_at:  new Date().toISOString(),
    })
    if (pErr) { stats.errors.push(`project ${slug}: ${pErr.message}`); continue }
    stats.projects++

    const boardSlugs = await listDirs(`projects/${slug}/boards`)
    for (const boardSlug of boardSlugs) {
      const board = await readJson(`projects/${slug}/boards/${boardSlug}/board.json`)
      if (!board) continue

      const { error: bErr } = await supabase.from('boards').upsert({
        id:          board.id,
        project_id:  project.id,
        slug:        board.slug ?? boardSlug,
        name:        board.name,
        description: board.description ?? '',
        columns:     board.columns ?? [],
        card_order:  board.card_order ?? {},
        labels:      board.labels ?? [],
        archived:    board.archived ?? false,
        created_by:  board.created_by,
        created_at:  board.created_at,
        updated_at:  new Date().toISOString(),
      })
      if (bErr) { stats.errors.push(`board ${slug}/${boardSlug}: ${bErr.message}`); continue }
      stats.boards++

      const cardDirs = await listDirs(`projects/${slug}/boards/${boardSlug}/cards`)
      for (const cardId of cardDirs) {
        const meta = await readJson(`projects/${slug}/boards/${boardSlug}/cards/${cardId}/meta.json`)
        if (!meta) continue

        const { error: cErr } = await supabase.from('cards').upsert({
          id:          meta.id,
          board_id:    board.id,
          title:       meta.title,
          description: meta.description ?? '',
          label_ids:   meta.label_ids ?? [],
          assignees:   meta.assignees ?? [],
          due_date:    meta.due_date ? meta.due_date.slice(0, 10) : null,
          priority:    meta.priority ?? 'none',
          checklist:   meta.checklist ?? [],
          archived:    meta.archived ?? false,
          created_by:  meta.created_by,
          created_at:  meta.created_at,
          updated_at:  meta.updated_at ?? meta.created_at,
        })
        if (cErr) { stats.errors.push(`card ${cardId}: ${cErr.message}`); continue }
        stats.cards++
      }
    }
  }

  console.log('\nMigration complete:')
  console.log(`  projects: ${stats.projects}`)
  console.log(`  boards:   ${stats.boards}`)
  console.log(`  cards:    ${stats.cards}`)
  if (stats.errors.length) {
    console.log(`  errors:   ${stats.errors.length}`)
    stats.errors.forEach(e => console.log(`    - ${e}`))
  }
}

migrate().catch(e => {
  console.error(e)
  process.exit(1)
})
