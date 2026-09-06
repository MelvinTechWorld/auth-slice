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

## Outstanding

Anything on the assessment's evidence checklist not yet captured. This list must
be empty before submission.

- [ ]
