# ADR-0019: Members can delete their account; names and emails follow one shared rule

- Date: 2026-10-10
- Status: accepted

## Context

Jason asked for a way to remove an account by typing the credentials and confirming the deletion, and for every name and email field to state its requirements. Until now the forms checked email with a loose pattern, the name only for being non-empty, and the API with zod's defaults, so the two could disagree.

## Decision

- **One rule for names and emails** lives in `dependencies/src/fields.ts`. A name is letters from any alphabet, spaces, apostrophes, hyphens or periods, with at least one letter, up to 80 characters. An email is a valid address up to 254 characters. The API schemas (`SignupSchema`, `LoginSchema`, `CreateProfileSchema`, `DeleteAccountSchema`) and every form use the same functions. Each field shows its requirement (NOTE) from the start and the exact problem (ERR) once it is left; the submit waits until all pass.
- **Deletion re-checks the credentials.** `POST /api/auth/account/delete` takes `{ email, password, confirm: "DELETE" }` from a signed-in member. The pair must be the signed-in account's own; a valid token alone is not enough. It then removes the account's Arc messages, sessions, plans, profiles and the user, and answers `204`.
- **A wrong pair answers 403, not 401.** Across the API, 401 means "your token is no longer good", and the browser signs out on it. A typo on the delete form must not end the session.
- **Five wrong tries in 15 minutes lock the form** for the rest of the window (`429`), counted per account in memory. The API runs as one process on Render; if it ever scales out, this moves to the database.
- **Tokens for deleted accounts stop working at once.** `authenticate` now checks that the user still exists on each request, at the cost of one indexed lookup. Tokens stay stateless otherwise.
- **The account page is reached from the account tag** (the rail avatar, and the phone bar's last cell, which on phones also replaces the log-out button: there is no room for a sixth cell). Log out moves onto the page there. After deletion the member lands on the home page with a notice.

## Consequences

- Accounts created before this rule may hold names it would now refuse. They keep working: the rule applies to new input only.
- The password is never logged, put in a URL or echoed in an error, and the tests assert the last.
