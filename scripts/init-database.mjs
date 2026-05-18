/**
 * Tworzy pusty plik database.sqlite ze schematem z database/schema.sql.
 * Uruchom: npm run db:init
 */

import initSqlJs from 'sql.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const schemaPath = path.join(root, 'database', 'schema.sql')
const outPath = path.resolve(root, process.argv[2] ?? 'database.sqlite')

const SQL = await initSqlJs({
  locateFile: (file) =>
    path.join(root, 'node_modules', 'sql.js', 'dist', file),
})

const schema = fs.readFileSync(schemaPath, 'utf8')
const db = new SQL.Database()
db.run(schema)

const bytes = db.export()
fs.writeFileSync(outPath, Buffer.from(bytes))
db.close()

console.log(`Utworzono: ${outPath} (${bytes.length} bajtów)`)
console.log('Tabele:', listTables(SQL, bytes).join(', '))

function listTables(SQL, data) {
  const check = new SQL.Database(data)
  const stmt = check.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
  )
  const names = []
  while (stmt.step()) names.push(stmt.get()[0])
  stmt.free()
  check.close()
  return names
}
