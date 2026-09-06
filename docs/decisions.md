# Decision Log

Every non-obvious choice made in this repository, recorded when it was made.

**Why this file exists:** Section 5 of `DOCUMENTATION.md` requires four answers
per concept, and the fourth is *what I chose against, and why*. That question is
unanswerable a week later if the choice was made silently. This file is filled in
at the moment of the decision so that writing Section 5 is a reformatting job,
not an archaeology job.

**The rule:** the agent proposes options and never chooses. I choose, and the
"why" below is written in my own words. An agent-written "why" is worth nothing
at the defence.

---

## Template — For each decision

```
## [Decision name — use the same name as the Section 5 concept where possible]

- **Date:**
- **What it is (my words, 2–3 sentences, as if to someone who has never heard the term):**
- **What breaks without it (concrete, name the failure, no "so it's secure"):**
- **What I chose:**
- **What I chose against:**
- **Why (the real reason, including "it was the one I could reason about"):**
- **Where it lives:** `path/to/file.ts`
- **Tunable values set, and why those numbers:**
- **Was this choice forced? If so, by what:**
```

Those fields map onto Section 5's four questions directly:

| Field here | Section 5 question |
|---|---|
| What it is | 1. What it is |
| What breaks without it | 2. Why it is needed |
| What I chose + where it lives + tunables | 3. How I implemented it |
| What I chose against + why | 4. What I chose against, and why |

---

## Decisions

<!--
Append below, newest at the bottom. Do not delete entries when you change your
mind — add a new entry that supersedes the old one and say so. A reversed
decision is good Section 6 material.
-->

## Session Management (DB-backed vs Tokens)

- **Date:** 2026-09-05
- **What it is:** A session is a record on the server that says "this person is currently signed in." When a user signs in, I create a row in the database and give the browser a cookie containing its ID. Every request after that, the cookie is checked against that row.
- **What breaks without it:** Without server-side sessions, I'd have no way to force someone out of their account immediately. If I used a stateless JWT instead, a stolen token stays valid until it expires no matter what I do on the server afterward.
- **What I chose:** DB-backed sessions stored in a PostgreSQL `sessions` table.
- **What I chose against:** Stateless JWTs stored in cookies.
- **Why:** I need sign-out to actually end the session on the server, not just delete a cookie on the client. A JWT can't be revoked before it expires without a blacklist, which is extra infrastructure this slice doesn't need.
- **Where it lives:** `prisma/schema.prisma`
- **Tunable values set, and why those numbers:** Session expiry set separately — see cookie config once implemented.
- **Was this choice forced? If so, by what:** No, JWTs were a real option. I chose DB sessions because immediate revocation mattered more than avoiding one extra database lookup per request.

## Rate Limiting Store

- **Date:** 2026-09-05
- **What it is:** A record of how many times someone has tried an action, like signing in, within a given time window, so I can block them once they cross a limit.
- **What breaks without it:** Without it, someone could send thousands of signin attempts per minute and eventually guess a weak password, and each attempt would cost me a full database query with no cost to the attacker.
- **What I chose:** Database table (`rate_limits`) in PostgreSQL.
- **What I chose against:** Redis or an in-memory store.
- **Why (the real reason, including "it was the one I could reason about"):** I didn't want to add a new service like Redis for one table's worth of data on a slice this small, and the brief doesn't require multi-server support, so a plain table does the job without extra infrastructure.
- **Where it lives:** `prisma/schema.prisma`
- **Tunable values set, and why those numbers:** Window and limit values to be set per route (signin, signup, reset request, resend).
- **Was this choice forced? If so, by what:** No, Redis was viable. I chose the database table because it's simpler for a single-instance slice, and the rule against adding new services without asking made Redis the harder sell.

## Database Constraints (Idempotency)

- **Date:** 2026-09-05
- **What it is:** A unique constraint is a rule the database enforces itself: no two rows can have the same value in that column. Here, no two users can share an email.
- **What breaks without it:** If I only checked "does this email exist" in my code before inserting, two signup requests arriving in the same instant could both pass that check before either has written a row, creating two accounts with the same email.
- **What I chose:** Unique constraint on `email` at the database level.
- **What I chose against:** Check-then-insert (race condition) or an idempotency key table.
- **Why:** The unique constraint is the only thing that closes that race, because the database rejects the second insert atomically. My application code can't guarantee that on its own.
- **Where it lives:** `prisma/schema.prisma`
- **Tunable values set, and why those numbers:** None
- **Was this choice forced? If so, by what:** Effectively yes, for correctness. Check-then-insert looks like it works in manual testing but fails exactly when it matters — under concurrent load.

## Reset Token Storage

- **Date:** 2026-09-05
- **What it is:** Hashing the reset token means storing a one-way scrambled version of it rather than the token itself — the same idea as password hashing.
- **What breaks without it:** A reset token is effectively a temporary password for the account. If my database were ever read by someone who shouldn't have it, a plaintext token would hand them a working account-takeover link for anyone with a pending reset.
- **What I chose:** Store a hash of the reset token in the database.
- **What I chose against:** Storing the reset token in plain text.
- **Why:** Hashing costs almost nothing to implement and removes a whole category of risk if the database is ever exposed.
- **Where it lives:** `prisma/schema.prisma`
- **Tunable values set, and why those numbers:** None
- **Was this choice forced? If so, by what:** No, but there was no real reason not to — it's the same pattern as password hashing and just as cheap. 

## Token and Code Expiry

- **Date:** 2026-09-05
- **What it is:** Expiry means the code or token stops being valid after a set time, and that time limit is checked in the database, not just shown as a countdown in the interface.
- **What breaks without it:** If expiry only lived in the UI, someone could intercept a code or token and use it hours later even though the screen says it expired — the interface countdown would be theatre with no real enforcement behind it.
- **What I chose:** 15-minute TTL for verification codes, 1-hour TTL for password reset tokens, enforced in the database logic.
- **What I chose against:** Very short TTLs (e.g. 5 mins) or very long TTLs (e.g. 24 hours), or relying on UI-only countdowns.
- **Why:** 15 minutes for verification codes covers normal delay right after signup without leaving a long window open. 1 hour for reset tokens accounts for slower email delivery, since a locked-out user is more frustrating than a slightly longer risk window.
- **Where it lives:** `prisma/schema.prisma`
- **Tunable values set, and why those numbers:** 15 minutes and 1 hour.
- **Was this choice forced? If so, by what:** No, these are judgment calls balancing security against convenience, not forced by the brief. 

## Resend Cooldown

- **Date:** 2026-09-05
- **What it is:** A resend cooldown is a minimum wait time enforced on the server before another verification email can be sent.
- **What breaks without it:** Every resend costs me an email send. Without a server-enforced cooldown, a bot or impatient user could hammer the resend button and run up my email costs, and a client-only cooldown wouldn't stop a direct API call.
- **What I chose:** 60-second cooldown enforced on the server.
- **What I chose against:** Shorter cooldowns (e.g. 30 seconds) or allowing unthrottled resends.
- **Why:** 60 seconds is long enough to stop rapid abuse but short enough that a genuine user isn't stuck waiting if their email is slow.
- **Where it lives:** `prisma/schema.prisma`
- **Tunable values set, and why those numbers:** 60 seconds.
- **Was this choice forced? If so, by what:** No, 30 seconds or a few minutes would also work. 60 seconds felt like the middle ground. 

## Client-side vs Server-side Validation (Validation Library)

- **Date:** 2026-09-05
- **What it is (my words, 2–3 sentences, as if to someone who has never heard the term):** 
- **What breaks without it (concrete, name the failure, no "so it's secure"):** 
- **What I chose:** Zod (for a single shared schema module).
- **What I chose against:** Hand-rolled validation functions (e.g. `if (!email.includes('@'))`).
- **Why (the real reason, including "it was the one I could reason about"):** 
- **Where it lives:** `src/lib/validations/auth.ts`
- **Tunable values set, and why those numbers:** None
- **Was this choice forced? If so, by what:** 

## Password Hashing (Algorithm and Cost Factor)

- **Date:** 2026-09-05
- **What it is (my words, 2–3 sentences, as if to someone who has never heard the term):** 
- **What breaks without it (concrete, name the failure, no "so it's secure"):** 
- **What I chose:** bcrypt with a cost factor of 12.
- **What I chose against:** argon2id or scrypt.
- **Why (the real reason, including "it was the one I could reason about"):** 
- **Where it lives:** `src/lib/auth/password.ts`
- **Tunable values set, and why those numbers:** Cost factor set to 12.
- **Was this choice forced? If so, by what:** 

## Verification Code Format

- **Date:** 2026-09-05
- **What it is (my words, 2–3 sentences, as if to someone who has never heard the term):** 
- **What breaks without it (concrete, name the failure, no "so it's secure"):** 
- **What I chose:** 6-digit numeric format.
- **What I chose against:** 8-character alphanumeric code.
- **Why (the real reason, including "it was the one I could reason about"):** 
- **Where it lives:** `src/app/api/auth/signup/route.ts` and `src/lib/validations/auth.ts`
- **Tunable values set, and why those numbers:** 6 digits.
- **Was this choice forced? If so, by what:** 

## Cookie Flags

- **Date:** 2026-09-05
- **What it is (my words, 2–3 sentences, as if to someone who has never heard the term):** 
- **What breaks without it (concrete, name the failure, no "so it's secure"):** 
- **What I chose:** `httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/'`, maxAge matching session TTL.
- **What I chose against:** Permissive defaults (`httpOnly: false`, `sameSite: 'none'`).
- **Why (the real reason, including "it was the one I could reason about"):** 
- **Where it lives:** `app/api/auth/verify/route.ts`
- **Tunable values set, and why those numbers:** 
- **Was this choice forced? If so, by what:** 
