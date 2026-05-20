# Marketing Demo

Przykładowy projekt z tablicą **Campaign** (4 karty) i załącznikami: markdown, SVG, canvas, JSON.

## Wdrożenie

1. Commit i push folderu `projects/demo-marketing` na GitHub.
2. Z katalogu głównego repozytorium (wymaga `GITHUB_TOKEN` i `SUPABASE_SERVICE_ROLE_KEY` w `.env`):

```bash
node scripts/migrate-github-to-supabase.mjs
```

3. Odśwież aplikację — projekt **Marketing Demo** pojawi się na liście projektów.

Vault dokumentów jest w `boards/campaign/cards/{card-id}/` (poza `meta.json`).
