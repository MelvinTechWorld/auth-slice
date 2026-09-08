# Evidence Log

Every piece of captured proof required by the brief, logged when captured.

**Why this file exists:** the briefs require database screenshots, curl output,
and measurement tables that cannot be reconstructed after the fact. Assessment 2
states outright that *claims without screenshots do not count*. Assessment 4's
baseline query counts are gone forever once the code is optimised.

**Where files go:** `/evidence/` in the repository root. Reference them from
`DOCUMENTATION.md` with relative paths so they render on GitHub.

**Naming:** `NN-short-description.png` — e.g. `01-users-table-hash.png`. Number
them in the order the brief lists them so a reviewer can follow along.

---

## Captured

| # | File | What it shows | Which requirement it satisfies | Date |
|---|---|---|---|---|
| 01 | `01-signup-curl-failure.txt` | Output from curl hitting signup with invalid data. | Signup validation blocks bad requests and bypasses UI. | 2026-09-05 |
| 02 | `02-signup-curl-success.txt` | Output from curl hitting signup with valid data. | Signup accepts good requests and returns success. | 2026-09-05 |
| 03 | `03-users-table-hash.png` | Screenshot of the users table showing Alice's row. | Proves password is securely hashed and no plaintext password column exists. | 2026-09-05 |
| 04 | `04-verify-expired-code.txt` | Output from curl hitting verify with expired code. | Verify endpoint strictly enforces TTL. | 2026-09-06 |
| 05 | `05-verify-success.txt` | Output from curl hitting verify with fresh code. | Verify creates session with strict cookie flags. | 2026-09-06 |
| 06 | `06-sessions-table.png` | Screenshot of the sessions table showing Alice's new session. | Proves session was stored in DB. | 2026-09-06 |
| 07 | `07-verify-malformed.txt` | Output from curl hitting verify with malformed code. | Shared Zod schema works on the server. | 2026-09-06 |
| 08 | `08-ratelimit-resend.txt` | Output from curl hitting resend repeatedly. | Proves rate limit is enforced on resend with 429 status and Retry-After header. | 2026-09-07 |
| 09 | `09-ratelimit-signin.txt` | Output from curl hitting signin repeatedly. | Proves rate limit is enforced on signin with 429 status and Retry-After header. | 2026-09-07 |

---

## Curl commands used

Record the exact command and the exact response. Both are graded.

### Signup Endpoint (Failure Case)

```bash
# Command:
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "not-an-email", "password": "short"}'

# Response:
# HTTP 400 Bad Request with Zod validation error details for email and password fields.

# What this proves:
# Server-side validation effectively blocks bad requests, bypassing any client-side UI limitations.
```

### Signup Endpoint (Success Case)

```bash
# Command:
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com", "password": "SecurePassword123!"}'

# Response:
# HTTP 201 Created with a success message ("Account created successfully...").

# What this proves:
# The signup endpoint accepts valid inputs and processes them successfully to create an account.
```

---

### Verify Endpoint (Expired Case)

```bash
# Command:
curl -i -X POST http://localhost:3000/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "code": "123456"}'

# Response:
# HTTP 400 Bad Request with error: "Verification code has expired"

# What this proves:
# Server strictly enforces the verification code TTL.
```

### Verify Endpoint (Malformed Case)

```bash
# Command:
curl -i -X POST http://localhost:3000/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "code": "abc"}'

# Response:
# HTTP 400 Bad Request with Zod validation error: "must be exactly 6 digits"

# What this proves:
# Shared Zod schema validation is properly enforced on the server.
```

### Verify Endpoint (Success Case)

```bash
# Command:
curl -i -X POST http://localhost:3000/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "code": "123456"}'

# Response:
# HTTP 200 OK with Set-Cookie: sessionId=...; HttpOnly; Path=/; SameSite=Lax

# What this proves:
# Verify endpoint accepts a valid code and correctly sets a secure, HttpOnly, DB-backed session cookie.
```

---

### Rate Limiting (Resend Endpoint)

```bash
# Command:
for i in {1..4}; do curl -i -X POST http://localhost:3000/api/auth/resend -H "Content-Type: application/json" -d '{"email": "alice@example.com"}'; echo ""; done

# Response:
# HTTP 429 Too Many Requests with Retry-After header and "Please wait before requesting another code."

# What this proves:
# Resend endpoint correctly enforces the 60-second cooldown limit and provides a Retry-After header.
```

### Rate Limiting (Signin Endpoint)

```bash
# Command:
for i in {1..6}; do curl -i -X POST http://localhost:3000/api/auth/signin -H "Content-Type: application/json" -d '{"email": "alice@example.com", "password": "wrong"}'; echo ""; done

# Response:
# First 5: HTTP 401 Unauthorized. 6th: HTTP 429 Too Many Requests with Retry-After header and "Too many requests. Please try again later."

# What this proves:
# Signin endpoint strictly enforces the fixed window rate limit via the database, returning correct status codes and headers.
```

---

## Outstanding

Anything on the assessment's evidence checklist not yet captured. This list must
be empty before submission.

- [ ]
