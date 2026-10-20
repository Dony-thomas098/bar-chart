---
trigger: always_on
---

- Stack: Next.js 16 static export, React 19, TypeScript, Tailwind v4, Supabase, IndexedDB, Capacitor.
- No any. Handle every async error.
- Offline first: save to IndexedDB, then the pending_saves queue.
- Make small changes only. Don't touch working code or UI.
- Ask before adding packages or changing the database.
- Add a test for every logic fix.
- Run lint, test, and build before finishing.