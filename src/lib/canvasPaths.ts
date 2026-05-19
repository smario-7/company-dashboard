export interface CanvasPathEntry {
  path: string
  name: string
}

export function cardBasePath(
  projectSlug: string,
  boardSlug: string,
  cardId: string,
): string {
  return `projects/${projectSlug}/boards/${boardSlug}/cards/${cardId}`
}

function allEntries(
  cardFiles: CanvasPathEntry[],
  assets: CanvasPathEntry[],
): CanvasPathEntry[] {
  return [...cardFiles, ...assets]
}

function pathsSet(entries: CanvasPathEntry[]): Set<string> {
  return new Set(entries.map(e => e.path))
}

export function normalizeFilePathOnImport(
  ref: string,
  cardFiles: CanvasPathEntry[],
  assets: CanvasPathEntry[] = [],
): string {
  const entries = allEntries(cardFiles, assets)
  const paths = pathsSet(entries)

  if (paths.has(ref)) return ref

  const basename = ref.split('/').pop() ?? ref
  const byName = entries.filter(e => e.name === basename)
  if (byName.length === 1) return byName[0].path

  const ci = entries.filter(e => e.name.toLowerCase() === basename.toLowerCase())
  if (ci.length === 1) return ci[0].path

  return ref
}

export function toVaultFilePath(
  ref: string,
  cardFiles: CanvasPathEntry[],
  assets: CanvasPathEntry[] = [],
): string {
  if (!ref.trim()) return ref
  return normalizeFilePathOnImport(ref, cardFiles, assets)
}

export function isKnownVaultPath(
  ref: string,
  cardFiles: CanvasPathEntry[],
  assets: CanvasPathEntry[] = [],
): boolean {
  return pathsSet(allEntries(cardFiles, assets)).has(ref)
}
