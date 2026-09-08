# Auth Slice — Documentation

## 1. What This Is

This is a complete authentication slice for a Next.js app: a user can create an account, verify their email with a 6-digit code, sign in, reset a forgotten password, and reach a signed-in dashboard. Every screen is backed by a real endpoint — signup with idempotent account creation and bcrypt password hashing, email verification with database-enforced code expiry, a resend flow with a server-side cooldown, signin with session cookies, and a full forgot/reset password flow using single-use hashed tokens. Every authentication route is rate limited, and the dashboard is a protected route that redirects unauthenticated visitors to sign in.

What's deliberately not here: no profile editing, no settings, no social sign-in, no two-factor authentication, and no dashboard beyond a single line showing the signed-in user's name and a sign-out button. The brief scoped this as a single slice, not an application, so anything outside the six required screens and their backing logic was left out on purpose, keeping the authentication itself as the only thing in the repository.

## 2. How To Run It

**Prerequisites**

- Node.js (v18+)
- npm
- PostgreSQL database (e.g., local Postgres or a Neon database)

**Steps**

1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Copy `.env.example` to `.env` and fill in the required variables.
4. Run the Prisma setup commands to synchronize the database schema.
5. Start the development server.

**Environment variables**

| Name | Where it comes from |
|---|---|
| `DATABASE_URL` | Your PostgreSQL provider (e.g., Neon connection string). Must include credentials. |

**Database setup**

```bash
npm run contract:emit
npx prisma db push
```

**Start it**

```bash
npm run dev
```

**It appears at:** `http://localhost:3000`

## 3. The Flow, Step By Step

### Step 1 — Account Creation

**User:** Enters their name, email, and password on the signup page and clicks submit.
**Frontend sends:** A JSON payload containing `name`, `email`, and `password`.
**Server does:** Validates the input using the shared Zod schema. If valid and the email isn't taken, it hashes the password using bcrypt, creates the user in the database, generates a 6-digit verification code with a 15-minute TTL, logs it to the console (simulating an email), and returns a 201 Created.
**Lives in:** 
- UI: `app/signup/page.tsx`
- Endpoint: `app/api/auth/signup/route.ts`

### Step 2 — Email Verification

**User:** Is redirected to the verify screen and types the 6-digit code they received.
**Frontend sends:** A JSON payload with `email` and the 6-digit `code`.
**Server does:** Looks up the pending verification code in the database, verifying that it matches and hasn't expired. If valid, it destroys the code, creates a DB-backed session row for the user, and issues an `HttpOnly`, `SameSite=lax` session cookie.
**Lives in:** 
- UI: `app/verify/page.tsx`
- Endpoint: `app/api/auth/verify/route.ts`

### Step 3 — Resend Verification Code (Optional)

**User:** Clicks the "Resend Code" button on the verification screen if they didn't receive the email.
**Frontend sends:** A JSON payload containing the `email`.
**Server does:** Looks up the existing pending code. If 60 seconds have passed since the last request, it updates the `lastSentAt` timestamp and logs the code to the console again. If not, it returns a 429 Too Many Requests response with a `Retry-After` header.
**Lives in:**
- UI: `app/verify/page.tsx`
- Endpoint: `app/api/auth/resend/route.ts`

### Step 4 — Sign In

**User:** Enters their email and password on the sign-in page to access their account.
**Frontend sends:** A JSON payload with `email` and `password`.
**Server does:** Looks up the user by email, compares the provided password against the stored bcrypt hash, and if they match, mints a new database session and issues the session cookie.
**Lives in:** 
- UI: `app/signin/page.tsx`
- Endpoint: `app/api/auth/signin/route.ts`

### Step 5 — Forgot Password Request

**User:** Visits the forgot password page, enters their registered email, and submits.
**Frontend sends:** A JSON payload containing the `email`.
**Server does:** Generates a 64-character secure random token, hashes it with SHA-256, and stores the hash in the database with a 1-hour TTL. It then constructs a reset link containing the raw token and logs it to the console. It deliberately returns a generic success message to prevent user enumeration.
**Lives in:** 
- UI: `app/forgot-password/page.tsx`
- Endpoint: `app/api/auth/forgot-password/route.ts`

### Step 6 — Reset Password

**User:** Clicks the link in their email and submits a new password on the reset screen.
**Frontend sends:** A JSON payload with the raw `token` and the new `password`.
**Server does:** Hashes the provided token and looks it up in the database. If it exists and hasn't expired, it hashes the new password with bcrypt, updates the user's record, and invalidates all existing sessions and reset tokens for that user.
**Lives in:** 
- UI: `app/reset-password/page.tsx`
- Endpoint: `app/api/auth/reset-password/route.ts`

### Step 7 — The Protected Dashboard

**User:** Attempts to visit the application dashboard.
**Frontend sends:** A standard GET request containing the `sessionId` cookie.
**Server does:** Reads the cookie and checks the database to ensure the session exists, belongs to a valid user, and hasn't expired. If valid, the user's name is fetched and the dashboard renders. If invalid or missing, it redirects the browser back to the sign-in page.
**Lives in:** `app/dashboard/page.tsx`

### Step 8 — Sign Out

**User:** Clicks the "Sign Out" button on the dashboard.
**Frontend sends:** A standard POST request (via a form submission).
**Server does:** Reads the current session cookie, deletes the corresponding session row in the database, clears the browser's cookie, and redirects the user to the sign-in page.
**Lives in:** `app/api/auth/signout/route.ts`

## 4. The Data Model

### `User`

The core identity record holding the user's details and credentials.

| Column | Type | Constraint | Decision |
|---|---|---|---|
| `id` | `String` | `@id @default(uuid())` | UUIDs prevent enumeration attacks (no guessing user count or ID sequences). |
| `email` | `String` | `@unique` | Enforces that an email can only be registered once at the database level, making duplicate accounts impossible even if app logic fails. |
| `passwordHash` | `String` | None | Stores the bcrypt hash. Never plaintext. Required field to ensure no user can exist without a password. |
| `name` | `String` | None | Stored directly on the user for the placeholder dashboard. |
| `createdAt` | `TimestamptzString` | `@default(now())` | Useful for audit logging and time-based cleanup if needed. |

### `Session`

Tracks active sign-in instances for users, allowing for immediate revocation.

| Column | Type | Constraint | Decision |
|---|---|---|---|
| `id` | `String` | `@id @default(uuid())` | The session token issued to the client cookie. Must be unguessable. |
| `userId` | `String` | `@relation(onDelete: Cascade)` | A foreign key ensuring every session points to a real user, and is destroyed if the user is deleted. |
| `expiresAt` | `TimestamptzString` | None | Checked on every authenticated request to strictly enforce the TTL, independently of the cookie's Max-Age. |
| `createdAt` | `TimestamptzString` | `@default(now())` | |

### `VerificationCode`

Holds the 6-digit email verification codes sent during signup.

| Column | Type | Constraint | Decision |
|---|---|---|---|
| `id` | `String` | `@id @default(uuid())` | |
| `userId` | `String` | `@relation(onDelete: Cascade)` | Foreign key tying the code directly to the user who requested it. |
| `code` | `String` | None | The 6-digit numeric string the user must type in. |
| `expiresAt` | `TimestamptzString` | None | Hard 15-minute TTL checked at the time of submission. |
| `lastSentAt` | `TimestamptzString` | `@default(now())` | Tracks the exact timestamp the code was last emailed to enforce the 60-second resend cooldown. |
| `createdAt` | `TimestamptzString` | `@default(now())` | |

### `PasswordResetToken`

Stores the hashed tokens used for the forgot-password flow.

| Column | Type | Constraint | Decision |
|---|---|---|---|
| `id` | `String` | `@id @default(uuid())` | |
| `userId` | `String` | `@relation(onDelete: Cascade)` | Foreign key linking the reset token to the specific user account. |
| `tokenHash` | `String` | `@unique` | The SHA-256 hash of the 64-character raw token sent via email. Stored as a hash so database leaks don't compromise reset links in transit. |
| `expiresAt` | `TimestamptzString` | None | Hard 1-hour TTL checked at the time of reset submission. |
| `createdAt` | `TimestamptzString` | `@default(now())` | |

### `RateLimit`

Tracks endpoint usage counts to enforce fixed-window rate limiting.

| Column | Type | Constraint | Decision |
|---|---|---|---|
| `key` | `String` | `@id` | A compound string (`action:ip`) to uniquely track usage per endpoint per user. |
| `points` | `Int` | `@default(1)` | The number of times the endpoint has been hit in the current window. |
| `expiresAt` | `TimestamptzString` | None | The exact timestamp when the current window expires and points reset to 0. |

### Schema definition (`prisma/schema.prisma`)

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  name         String
  createdAt    DateTime @default(now())

  sessions            Session[]
  verificationCodes   VerificationCode[]
  passwordResetTokens PasswordResetToken[]
}

model Session {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model VerificationCode {
  id         String   @id @default(uuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  code       String
  expiresAt  DateTime
  lastSentAt DateTime @default(now())
  createdAt  DateTime @default(now())
}

model PasswordResetToken {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model RateLimit {
  key       String   @id
  points    Int      @default(1)
  expiresAt DateTime
}
```

### Which constraints make an invalid state impossible?

The @unique constraint on User.email makes it impossible for two accounts to ever share the same email, no matter what the application code does — this is what makes signup idempotent, since the database itself rejects a duplicate insert at write time rather than relying on a check-then-insert that could race under concurrent requests.

The @relation(onDelete: Cascade) foreign keys on Session.userId, VerificationCode.userId, and PasswordResetToken.userId make it impossible for any of these records to exist without pointing at a real user. They also mean that if a user were ever deleted, their sessions, codes, and reset tokens are automatically removed with them, rather than surviving as orphaned rows that reference a user who no longer exists.

The @unique constraint on PasswordResetToken.tokenHash makes it impossible for two different reset requests to ever collide on the same hash, which matters because a collision would let one user's reset token accidentally validate against another user's request.

None of the expiresAt columns are nullable — a Session, VerificationCode, or PasswordResetToken cannot exist without an expiry already attached to it at creation time. This is what makes the expiry checks structural rather than optional: expiry isn't something the application code decides to check, it's a value that has to exist on every row from the moment it's created.

The RateLimit.key primary key, built as a compound string of action and identifier, makes it impossible for two separate rate-limit counters to accidentally merge into one bucket — a signin attempt and a resend attempt for the same user are guaranteed to be tracked as two distinct rows, not one shared count.


## 5. The Concepts

### Password Hashing

**What it is.**
Hashing turns a password into a fixed-length string that can't be reversed back into the original. When someone signs up or resets their password, I hash what they typed with bcrypt before storing it. When they sign in, I hash the password they entered and compare it against the stored hash — the real password itself is never stored anywhere in the database.

**Why it is needed.**
If my database were ever read by someone who shouldn't have access to it, plaintext passwords would hand that person every account immediately — and because people reuse passwords across services, it would hand them accounts elsewhere too. Hashing means a stolen database only gives an attacker a set of strings that are deliberately expensive to reverse.

**How I implemented it.**
I used bcrypt with a cost factor of 12, isolated in lib/auth/password.ts with two exported functions — one to hash a password, one to compare a plaintext attempt against a stored hash. The hash is generated at signup and at password reset, and compared at signin.

**What I chose against, and why.**
I considered argon2id, which is the more modern algorithm and memory-hard, making it more resistant to GPU-based attacks than bcrypt's purely CPU-bound approach. I chose bcrypt anyway because argon2id relies on native bindings that can cause deployment headaches on some platforms, and bcrypt is the time-tested, universally supported standard in the Node.js ecosystem. For a slice this size, being able to reason confidently about the choice mattered more than picking the theoretically stronger option.

### Rate Limiting

**What it is.**
Rate limiting tracks how many times someone has attempted an action — like signing in or requesting a verification code — within a set time window, and blocks further attempts once they cross a limit.

**Why it is needed.**
Without it, someone could send thousands of signin attempts per minute and eventually guess a weak password, with each attempt costing me a full database query and no cost at all to the attacker. On the resend route specifically, every request sends a real email — without a limit, a bot or an impatient user could trigger hundreds of emails an hour and run up the cost of the email provider.

**How I implemented it.**
I built a shared rate limiting utility in lib/rate-limit.ts using a fixed-window strategy backed by a rateLimit table in PostgreSQL — the same database the rest of the app already uses, rather than introducing a new service like Redis. It's wired into signup and signin at 5 attempts per 15 minutes, and forgot-password and resend at 3 attempts per 15 minutes, since those routes are more expensive to abuse. When the limit is hit, the endpoint returns 429 Too Many Requests with a Retry-After header telling the client exactly how many seconds to wait.

**What I chose against, and why.**
For the store, I considered Redis, which is the industry standard for this and faster under load, but it would have introduced a new infrastructure dependency I didn't need for a single-instance slice — the database table does the job with what I already had running. For the strategy, I considered a token bucket, which is mathematically better at smoothing bursts, but it's much harder to implement safely in Postgres without race conditions, whereas a fixed window is simple, legible, and defensible even though it technically allows a short burst right at the window boundary. For the response, I considered returning a generic 400 without a retry hint, which would hide from an attacker exactly when the limit resets — but that also degrades the experience for a genuine user who has no way to know when to try again, so I included the Retry-After header despite that tradeoff.


### Client-Side vs Server-Side Validation

**What it is.**
Client-side validation checks input in the browser before it's ever sent to the server — catching an obviously invalid email or a too-short password immediately, without a network round trip. Server-side validation checks the same input again once it reaches the server, using the same rules, right before anything gets written to the database.

**Why it is needed.**
Client-side validation alone isn't real validation — it's only a convenience. Anyone can bypass a browser form entirely and send a request directly to the endpoint with curl or any HTTP client, skipping every check the UI would have enforced. If the server doesn't independently verify the same rules, malformed or malicious data reaches the database regardless of what the form looked like.

**How I implemented it.**
I declared every validation rule once, as a Zod schema, in a shared module at lib/validations/auth.ts. Both the signup form on the client and the signup route on the server import the exact same schema — the client uses it to show inline errors as the user types, and the server uses it to reject the request before touching the database, returning a 400 with the specific field errors if anything fails. I proved this works by hitting the signup endpoint directly with curl, bypassing the browser entirely, using a malformed email and a short password — the server rejected both with the same validation messages the UI would have shown. One rule can't be enforced on the client at all: whether an email is already registered. The client can check that a string looks like a valid email, but only the server can know whether that email already exists in the database, since that requires a lookup the browser has no access to — this is enforced by the unique constraint on the email column, not by Zod.

**What I chose against, and why.**
I considered writing the client and server checks separately — for example, a quick inline if check in the React form, and a different, possibly stricter check in the route handler. I chose against this because two separate implementations of the same rule inevitably drift apart over time; someone updates the password length requirement in one place and forgets the other, and now the client and server disagree about what's valid. Declaring the rule once and importing it everywhere makes that kind of drift structurally impossible rather than something I have to remember to keep in sync.

### Session Management

**What it is.**
A session is a record on the server that says "this person is currently signed in." When someone signs in or verifies their email, I create a row in a session table and give their browser a cookie containing that session's ID. On every request after that, the cookie is checked against the database to confirm the session still exists and hasn't expired.

**Why it is needed.**
Without server-side sessions, I'd have no way to force someone out of their account immediately. If I used a stateless approach like a JWT instead, a stolen or leaked token would stay valid until it naturally expired, no matter what I did on the server in the meantime — there'd be nothing to revoke.

**How I implemented it.**
Sessions are stored in a session table in PostgreSQL, created on successful signin or email verification. The session cookie is set with httpOnly: true, secure enabled in production, sameSite: 'lax', and a Max-Age matching the session's TTL. I confirmed this with curl -i against the verify endpoint, which showed the exact Set-Cookie header being returned, and confirmed the matching row appearing in the session table in the database.

**What I chose against, and why.**
I considered stateless JWTs stored in a cookie instead of a database-backed session. JWTs avoid the extra database lookup on every authenticated request, which is a real performance advantage, but they can't be revoked before they expire without adding a blacklist — extra infrastructure this slice doesn't need. I chose immediate revocation over saving one database query per request, since sign-out needing to actually end the session on the server, not just delete a cookie client-side, mattered more for this brief.

### Token and Code Expiry

**What it is.**
Expiry means a verification code or password reset token stops being valid after a set amount of time, and that time limit is checked against the database on every use — not just displayed as a countdown in the interface.

**Why it is needed.**
If expiry only lived in the UI, someone could intercept a code or a reset link and still use it hours later even though the screen had shown it expiring, because there'd be no actual enforcement behind that countdown. I confirmed this matters in practice: when I tried to verify with a code after its window had passed, the server correctly rejected it with "Verification code has expired" — proving the check happens against the stored expiresAt timestamp in the database, not against anything the browser is tracking.

**How I implemented it.**
Verification codes get a 15-minute TTL, and password reset tokens get a 1-hour TTL, both stored as an expiresAt column checked at the moment of use. Verification codes are generated as 6-digit numeric strings, which are easier to type than an alphanumeric code — the lower entropy this trades away is covered by the short TTL and the rate limiting already in place on the verify and resend routes, so brute-forcing a 6-digit code within 15 minutes isn't realistically possible.

**What I chose against, and why.**
For the TTLs, I considered a much shorter window like 5 minutes, which would reduce the risk window further but could expire before a delayed email arrives, and a much longer one like 24 hours, which is more convenient but leaves the account exposed for far longer than necessary. I chose 15 minutes and 1 hour as the middle ground between those two failure modes. For the code format, I considered an 8-character alphanumeric code for its higher entropy, but chose the numeric code because the security is coming from the rate limit and TTL together, not from the code's length alone, and a numeric code is significantly easier to type on a phone keyboard.

### Database Constraints as a Last Line of Defence

**What it is.**
A database constraint is a rule the database itself enforces, regardless of what the application code does or fails to do — a unique constraint, a foreign key, or a required column that makes certain invalid states impossible to create, even if a bug somewhere in my code tries to.

**Why it is needed.**
Application code has bugs. If the only thing preventing two accounts from sharing an email, or a session from pointing at a user that doesn't exist, is a check I wrote in a route handler, then a future change to that handler — made by me, or by an agent, in a hurry — can silently remove that protection with nothing to catch it. A constraint at the database level can't be bypassed by a mistake in application logic, because the database rejects the invalid write no matter which code path produced it.

**How I implemented it.**
The @unique constraint on User.email makes duplicate accounts impossible at the database level, which is what actually makes signup idempotent. The @relation(onDelete: Cascade) foreign keys on Session, VerificationCode, and PasswordResetToken guarantee every one of those rows points to a real user, and are automatically cleaned up if that user is ever deleted. None of the expiresAt columns are nullable, which means expiry isn't something my application code chooses to check — every session, code, and token has an expiry attached the moment it's created, so the check is structural rather than optional.

**What I chose against, and why.**
The alternative to each of these constraints was enforcing the same rule only in application code — checking for an existing email before inserting, or trusting that a session row would always be created with a valid user ID because that's what the current code happens to do. I chose the database constraints instead because they're the layer that still holds even when the application code changes, which matters most for guarantees — no duplicate emails, no orphaned sessions, no expiry-less tokens — that shouldn't ever be allowed to quietly break.


### Protected Routes

**What it is.**
A protected route is a page that requires a valid, active session to view — if someone without one tries to reach it directly, they're redirected somewhere else instead of seeing the page's content.

**Why it is needed.**
Without this check, anyone could type the dashboard's URL directly into their browser and see it, whether or not they'd ever signed in. Authentication only means something if the pages behind it actually enforce it — a login screen that people can simply route around by guessing a URL isn't really protecting anything.

**How I implemented it.**
The dashboard checks for a valid session on every request before rendering anything. If no session cookie is present, or the session it points to doesn't exist or has expired in the database, the request is redirected to sign-in instead of the dashboard content ever being returned. I confirmed this directly: while signed out, visiting /dashboard redirected to /signin rather than showing the page, and after signing in successfully, the same URL correctly showed "Welcome, [name]" and the sign-out button.

**What I chose against, and why.**
I considered checking authentication only in the UI — for example, having the dashboard component check for a logged-in state on the client and redirect if it's missing. I chose against this because a client-side-only check can be bypassed entirely by disabling JavaScript or by hitting the underlying data an API route might expose directly, even if the page itself redirects. Checking the session on the server, before any content is sent to the browser, means there's no path to the dashboard's content that skips the check.


## 6. What Went Wrong

### Problem 1 — Signup endpoint returned a 404 despite compiling successfully

**The symptom.**
After the agent built the signup endpoint and the build passed with zero errors, hitting it with curl returned a full Next.js 404 HTML page instead of a JSON response — not an error, just as if the route didn't exist at all.

**The investigation.**
I first assumed the curl command itself was wrong, since I was translating bash syntax to Windows Command Prompt and had already hit quoting issues elsewhere. I retried the request with different quote escaping, which didn't change anything. I then checked that the dev server was actually running and rebuilt it from scratch, which also didn't help — the 404 persisted with a clean build.z

**The cause.**
The project had two separate app directories: an empty one at the project root (left over from the original create-next-app scaffold, where I'd chosen no src/ directory) and a second one at src/app/ containing the actual signup route the agent had written. Next.js only reads one app directory, and it was reading the empty root one — meaning the entire endpoint the agent built was invisible to the running server.

**The fix.**
I moved everything from src/app and src/lib up into root-level app/ and lib/ folders, then deleted the now-empty src/ directory entirely, so there was only one app directory for Next.js to find.

### Problem 2 — Moving the code out of src/ broke every import path

**The symptom.**
Immediately after fixing Problem 1, curl requests to the same signup endpoint returned a different error — a 500 with a Next.js compilation error: Module not found: Can't resolve '@/src/lib/auth/password'.

**The investigation.**
The error message pointed directly at the specific broken import, so this wasn't much of an investigation — I recognized immediately that moving the files hadn't updated the import statements inside them, which still referenced the old src/ paths.

**The cause.**
The signup route (and likely other files) imported shared modules using paths like @/src/lib/auth/password, which pointed at the location those files used to live in before I moved them. The move fixed where the files physically were, but not what the code inside them was still pointing to.

**The fix.**
I had the agent search the project for every remaining @/src/... import and update each one to the corrected path (e.g. @/lib/auth/password), then confirmed the dev server compiled without errors before retrying the same curl command.

### Problem 3 — Migration failed due to a duplicated variable name in .env

**The symptom.**
After filling in docs/decisions.md and setting up my Neon database connection string in .env, running the Prisma migration failed. The migration plan itself generated successfully, but the actual database update step failed.

**The investigation.**
Since the migration plan generated fine, I knew the schema itself wasn't the problem — the failure was specifically in the step that connects to the database, which pointed toward the connection string rather than anything in schema.prisma. I had the agent inspect the .env file directly rather than guessing at the Neon dashboard or the schema, since that was the most direct route to the value Prisma was actually reading.

**The cause.**
When I copied my Neon connection string into .env, I pasted it including the variable name that was already there, producing a duplicated line: DATABASE_URL=DATABASE_URL="postgresql://...". Prisma was reading the whole malformed string as the value, which meant the actual URL was invalid and the connection failed silently rather than with an obviously helpful error.

**The fix.**
I removed the duplicated DATABASE_URL= prefix so the line started cleanly with the connection string itself, then re-ran the migration, which applied successfully.

## 7. What This Slice Does Not Handle

**What breaks at scale**

- Rate limiting is enforced through a database table using a fixed-window strategy, which is simple and correct for a single-instance app but would need to move to something like Redis if this ran across multiple server instances, since a fixed window in Postgres doesn't coordinate across instances the way an in-memory or distributed store would. Sessions are similarly database-backed, which means every authenticated request costs a database read — fine at this scale, but a real bottleneck under heavy traffic.

**What I would need before real users touched it**

- Actual email delivery. Right now, verification codes and reset links are logged to the server console rather than sent through a real email provider — this was a deliberate choice to keep the slice focused on the authentication logic itself rather than third-party integration, but it would need to change before anyone but me could use this.

**Left out because it was outside the brief**

- Social sign-in, two-factor authentication, profile editing, and any dashboard functionality beyond the name and sign-out button. These were explicitly excluded by the assessment brief, not left out due to time.

**Left out because I ran out of time**

- Everything in scope was completed and nothing was cut for time.

## 8. If I Built This Again

The biggest thing I'd change is confirming the project's folder structure explicitly before letting the agent write any files, rather than assuming it would match what I'd chosen during scaffolding. I picked no src/ directory when running create-next-app, but the agent defaulted to writing the signup endpoint and its supporting files into src/app/ anyway, which Next.js silently ignored in favor of the empty app/ folder at the root. That mismatch cost real time — a 404 that looked like a routing bug, then a second round of fixing broken import paths after moving everything to the correct location. If I built this again, I'd state the exact folder structure as a rule up front, before any code was written, rather than discovering the conflict through a failed curl request.

## Evidence

### Signup — server-side validation rejects bad input

![Signup rejected for invalid email and short password](./evidence/00-curl-signup-failure.png)

**What this shows:** Hitting the signup endpoint directly with curl, bypassing
the browser entirely, with a malformed email and a short password. The server
returns 400 with Zod validation errors for both fields, proving validation is
enforced server-side and not just in the UI.

### Signup — successful account creation

![Signup succeeds and verification code is logged](./evidence/01-curl-signup-success.png)

**What this shows:** A valid signup request returns 201, and the server log
shows the verification code generated for that user, confirming the flow
proceeds correctly from account creation into email verification.

### Password hash stored, not plaintext

![Users table showing a bcrypt hash](./evidence/02-users-table-hash.png)

**What this shows:** The `passwordHash` column contains a bcrypt hash
(`$2b$12$...`), confirming the plaintext password is never stored.

### Verification code expiry enforced server-side

![Expired verification code rejected](./evidence/03-verify-expired-code-rejected.png)

**What this shows:** Submitting a verification code after its 15-minute TTL has
passed returns 400 with "Verification code has expired," proving expiry is
checked against the database on every submission, not just shown as a UI
countdown.

### Verification input validated by the shared schema

![Malformed verification code rejected](./evidence/04-verify-malformed-code.png)

**What this shows:** Submitting a code that isn't exactly 6 digits is rejected
by the same shared Zod schema used across the app, confirming validation isn't
duplicated or endpoint-specific.

### Successful verification sets a secure session cookie

![Verify succeeds and sets the session cookie](./evidence/05-verify-success-cookie.png)

**What this shows:** A valid code returns 200 with a `Set-Cookie` header
containing `HttpOnly`, `SameSite=lax`, and the configured `Max-Age`, matching
the cookie flags decided in `docs/decisions.md`.

### Session row created on successful verification

![Sessions table showing the new row](./evidence/06-sessions-table.png)

**What this shows:** The `session` table contains a row matching the session ID
issued in the cookie above, confirming the session is genuinely persisted in
the database, not just issued client-side.

### Password reset token is hashed before storage

![passwordResetToken table showing a hashed value](./evidence/07-reset-token-hashed.png)

**What this shows:** The `tokenHash` column holds a SHA-256 hash that is
completely different from the raw token sent in the reset email link,
confirming the raw token is never stored — only a hash of it.

### Rate limit triggers on the resend endpoint

![429 response after exceeding the resend limit](./evidence/08-rate-limit-resend-429.png)

**What this shows:** After 3 resend attempts, the 4th request returns 429 with
"Please wait before requesting another code," confirming the resend cooldown is
enforced server-side, not just disabled in the UI.

### Rate limit triggers on the signin endpoint, with retry indication

![401 then 429 with retry-after header](./evidence/09-rate-limit-signin-429.png)

**What this shows:** Repeated failed signin attempts first return 401
(invalid credentials, endpoint working correctly), then after 5 attempts
return 429 with a `retry-after: 885` header, giving the client an exact time
to wait before retrying — satisfying the Excellent-band requirement for a
retry indication.

