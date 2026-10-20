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

- Keep missing-account star defaults in `balance-defaults.ts` and reuse them in displays and transactions so starter credit cannot differ by feature.
- Admin withdrawal-history removal uses a per-viewer `hiddenFrom` list, not document deletion, to preserve payment records, pending totals, and the account owner's history.
