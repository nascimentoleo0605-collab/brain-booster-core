<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Decisions
- Only admins create accounts (public signup disabled); account creation runs in server functions in src/lib/admin.functions.ts — needs privileged access.
- First admin is created via /auth setup form, only while no admin exists.
- Question options stored as a JSON array of strings (2–6) so formats can grow later.
- PDF files are parsed locally in the admin browser and require review before database insertion, keeping source documents private.
