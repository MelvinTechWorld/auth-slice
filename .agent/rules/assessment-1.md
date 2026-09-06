# Assessment 1 — The Authentication Slice (working rules)

Full spec: `.agent/rules/brief-full.md`, section "ASSESSMENT 1".
This file is the working plan. Time budget: **14–18 hours.**

---

## Scope, in one line

Create account → verify email → reach a placeholder dashboard. Plus sign in,
forgot password, reset password, sign out. Nothing else exists.

**The dashboard is one line of text with the user's name and a sign-out button.**
If you are styling the dashboard, you are on the wrong task.

---

## Build order

Work top to bottom. Do not start a step until the one above it is committed.

1. **Schema first.** `users`, `sessions`, `verification_codes`,
   `password_reset_tokens`, `rate_limits` (or provider equivalent). Raise the
   decision points below before writing the migration.
2. **Shared validation schema module.** One file. Client and server both import
   it. This is required for the Excellent band and it is easier to do now than
   to retrofit.
3. **Password hashing module.** Isolated, one file, no route logic in it.
4. **Signup endpoint**, including idempotency, before any UI.
5. **Verification codes**, with DB-side expiry and server-enforced resend
   cooldown.
6. **Signin + session creation**, cookie configured correctly.
7. **Protected route handling** and the placeholder dashboard.
8. **Forgot password + reset**, single-use time-limited token.
9. **Rate limiting** on all four routes: signin, signup, reset request, resend.
10. **Accessibility pass**: labels programmatically bound to inputs, visible
    focus states on every interactive element.
11. **Evidence capture** (see checklist below).
12. `DOCUMENTATION.md`.

---

## Decision points — raise these with me before coding

Follow the decision protocol in `AGENTS.md`. Each of these goes in
`docs/decisions.md`.

| Decision | Alternatives you must present |
|---|---|
| Hashing algorithm | bcrypt vs argon2id vs scrypt |
| Cost factor / memory params | The number, and what it costs per login |
| Sessions vs tokens | DB-backed session vs stateless JWT |
| Cookie flags | `httpOnly`, `secure`, `sameSite` value, `maxAge`, path |
| Session storage | Database table vs signed cookie vs external store |
| Validation library | Whatever your stack offers, vs hand-rolled |
| Verification code format | Length, character set, numeric vs alphanumeric |
| Code TTL and reset token TTL | The actual minutes, and why |
| Resend cooldown length | The actual seconds, and how it is enforced |
| Rate limit strategy | Fixed window vs sliding window vs token bucket |
| Rate limit store | In-memory vs database vs Redis |
| Rate limit response | Which status code, and what retry indication |
| Idempotency mechanism | Unique constraint + catch vs idempotency key vs upsert |
| Reset token storage | Store the token vs store a hash of it |

That last one is worth flagging: a password reset token stored in plaintext is a
second password sitting in your database. Present both options.

---

## Anti-patterns — do not do these

Taken from the brief's Traps section.

- Validating only on the client and treating that as validation. Every rule must
  be enforced server-side, and the client copy is for feedback only.
- Building out the dashboard. It is one line of text and a button.
- Verification code expiry that exists only as a countdown in the UI. Expiry
  lives in the database and is checked server-side on every submission.
- Committing `.env`.
- Rate limiting signin and forgetting the resend route. **Resend is the one that
  costs money** — every resend sends an email.
- Storing the reset token in a way that lets it be used twice.

---

## Evidence checklist

Capture into `/evidence/` as you go. Log each one in `docs/evidence.md`.
Remind me before moving past the feature that produces it.

- [ ] **`users` table screenshot** showing a stored hash, with the whole row
      visible so it is clear no plaintext password column exists.
      → capture after step 4
- [ ] **The exact `curl` command** hitting the signup endpoint directly, plus
      the server's response. Run it twice: once with valid input, once with
      input the browser form would have blocked (short password, malformed
      email, missing field). The rejection is the point.
      → capture after step 4
- [ ] **Rate limit triggering**, showing the status code returned and any retry
      header or body field. Do this on the resend route as well as signin.
      → capture after step 9
- [ ] **Verification code in the database**, and a screenshot of the same record
      after expiry, showing the server rejects it.
      → capture after step 5

For the Excellent band, the curl evidence must show **the server rejecting what
the browser would have blocked**. Capture that pair deliberately.

---

## Section 5 concepts — I must cover all eight

Password hashing · Rate limiting · Client-side vs server-side validation ·
Session management (and why sessions or tokens) · Token and code expiry (and why
expiry lives in the DB) · Idempotency · Database constraints as a last line of
defence · Protected routes

Each gets four questions. The fourth — *what I chose against, and why* — comes
from `docs/decisions.md`.

---

## Defence questions — I will be asked these out loud

Build so that I can answer them. Ask me these before I submit.

1. Why that hashing algorithm, and what happens if I set the cost factor to 4?
2. Show me the exact line where the session is created and tell me what is
   inside the cookie.
3. I send your signup request twice in the same second. Walk me through what
   happens in the database.
4. Which of your validation rules cannot be enforced on the client, and why?

Question 3 is about the race, not the happy path. If the answer is "my code
checks whether the email exists first", that is not idempotency, that is a race
condition. The unique constraint is the answer.
