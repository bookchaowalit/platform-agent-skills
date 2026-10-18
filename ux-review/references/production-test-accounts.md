# Read-only review accounts on production (P0, P13)

Logged-in pages behave differently on production. Different data, builds, flags and
third-party services all change what users see. Re-checking them needs real sessions.
Use dedicated review accounts that only read, so the check changes nothing a customer or
the business sees.

## Before creating any account

- **Owner approval for each app:** get it in writing, with the list of roles. Creating
  an account on production is a production change.
- **Staging first:** if the app has a staging environment with the same build, use that
  and skip production accounts.
- **Do not reuse personal or customer accounts:** never use your own, a client's or a
  real user's account for review.

## Rules

| Rule | Detail |
| --- | --- |
| One account per role | Only the roles whose pages need a live check. Admin or staff accounts only when the owner asks, and with the lowest admin scope that can open the pages. |
| Recognisable | Use the address `uxreview+<app>-<role>@<owner's domain>` and the display name `UX Review (<role>)`. Set the app's test or internal flag where it has one, and exclude the account from analytics, reports, leaderboards, emails and payouts. |
| Read only | Allowed: sign in, open pages, open dialogs, switch tabs, read lists. Not allowed: create, submit, pay, invest, book, upload, message, invite, change settings. A write needs explicit approval, and must be reversed or cleaned up the same day. |
| No real identity | No real ID card numbers, bank details, phone numbers or addresses. If a page needs KYC to open, use the app's sandbox or mock path. Otherwise record the page as "not verified" instead. |
| Credentials | Keep them in the owner's password manager, or in a local env file outside every repository (`~/.config/ui-review/<app>.env`, mode 600). Never put them in reports, tickets, chat or commits. |
| Sessions | `ui_login.mjs` writes the session to `~/.local/state/ui-review/sessions/<app>-<role>.json` with mode 600, and refuses to write inside a git repository. Delete it after the review. |
| Rotation | Change passwords when a person or machine with access leaves, and at least every 90 days. |
| Inventory | Keep a list in the owner's private records of app, role, address, created date, approver, flags set, and the last review date. |
| Clean-up | Before closing an account, remove anything it created. Use the app's own delete or purge path. Never use raw SQL on production unless the owner approves that exact statement. |

## Using them

```bash
source ~/.config/ui-review/<app>.env   # exports UI_LOGIN_USER / UI_LOGIN_PASS for one role
node ../qa-testing/scripts/ui_login.mjs --url https://<app>/login \
  --out ~/.local/state/ui-review/sessions/<app>-<role>.json --success /<landing-path>
node ../qa-testing/scripts/ui_review.mjs --url https://<app>/<page> --widths 375,1440 \
  --storage-state ~/.local/state/ui-review/sessions/<app>-<role>.json --out 13-live/<role>
node scripts/ui_states.mjs --url https://<app>/<page> --widths 375,1440 \
  --storage-state ~/.local/state/ui-review/sessions/<app>-<role>.json --out 13-live/<role>-states
```

Sign-in that needs OTP, LINE or another identity provider cannot be scripted:

1. Sign in by hand in a browser.
2. Export its storage state to the same sessions folder.
3. Treat that file as a credential.

## Recording

In `13-release.md`, list every page checked per role and every action taken, which should
be reads only. Also list anything that could not be opened without a write, marked "not
verified" with the reason.
