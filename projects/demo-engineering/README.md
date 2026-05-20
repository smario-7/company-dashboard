# Engineering Demo

Przykładowy projekt z tablicą **Sprint** (3 karty): OpenAPI JSON, canvas architektury, release notes + SVG.

## Wdrożenie

1. Commit i push folderu `projects/demo-engineering` na GitHub.
2. Migracja do Supabase (razem z innymi projektami w `projects/`):

```bash
node scripts/migrate-github-to-supabase.mjs
```

3. Otwórz **Engineering Demo** → tablica **Sprint** w aplikacji.

Jeśli migracja wymaga Twojego loginu GitHub, zamień `created_by` w `project.json` i plikach `meta.json` na swój `github_login` przed pushem.
