const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, 'DOCUMENTATION.md');
let lines = fs.readFileSync(filepath, 'utf8').split(/\r?\n/);

let idx1 = lines.findIndex(l => l.startsWith('**Prerequisites**'));
let idx2 = lines.findIndex(l => l.startsWith('**It appears at:**'));

if (idx1 !== -1 && idx2 !== -1) {
    const sec2 = `**Prerequisites**

- Node.js (v18+)
- npm
- PostgreSQL database (e.g., local Postgres or a Neon database)

**Steps**

1. Clone the repository.
2. Run \`npm install\` to install dependencies.
3. Copy \`.env.example\` to \`.env\` and fill in the required variables.
4. Run the Prisma setup commands to synchronize the database schema.
5. Start the development server.

**Environment variables**

| Name | Where it comes from |
|---|---|
| \`DATABASE_URL\` | Your PostgreSQL provider (e.g., Neon connection string). Must include credentials. |

**Database setup**

\`\`\`bash
npm run contract:emit
npx prisma db push
\`\`\`

**Start it**

\`\`\`bash
npm run dev
\`\`\`

**It appears at:** \`http://localhost:3000\``.split('\n');

    lines.splice(idx1, (idx2 - idx1) + 1, ...sec2);
} else {
    console.log("Could not find section 2 bounds", idx1, idx2);
}

let idx3 = lines.findIndex(l => l.startsWith('### Step 1 — [what the user does]'));
let idx4 = lines.findIndex(l => l.startsWith('<!-- repeat -->'));

if (idx3 !== -1 && idx4 !== -1) {
    const sec3 = `### Step 1 — Account Creation

**User:** Enters their name, email, and password on the signup page and clicks submit.
**Frontend sends:** A JSON payload containing \`name\`, \`email\`, and \`password\`.
**Server does:** Validates the input using the shared Zod schema. If valid and the email isn't taken, it hashes the password using bcrypt, creates the user in the database, generates a 6-digit verification code with a 15-minute TTL, logs it to the console (simulating an email), and returns a 201 Created.
**Lives in:** 
- UI: \`app/signup/page.tsx\`
- Endpoint: \`app/api/auth/signup/route.ts\`

### Step 2 — Email Verification

**User:** Is redirected to the verify screen and types the 6-digit code they received.
**Frontend sends:** A JSON payload with \`email\` and the 6-digit \`code\`.
**Server does:** Looks up the pending verification code in the database, verifying that it matches and hasn't expired. If valid, it destroys the code, creates a DB-backed session row for the user, and issues an \`HttpOnly\`, \`SameSite=lax\` session cookie.
**Lives in:** 
- UI: \`app/verify/page.tsx\`
- Endpoint: \`app/api/auth/verify/route.ts\`

### Step 3 — Resend Verification Code (Optional)

**User:** Clicks the "Resend Code" button on the verification screen if they didn't receive the email.
**Frontend sends:** A JSON payload containing the \`email\`.
**Server does:** Looks up the existing pending code. If 60 seconds have passed since the last request, it updates the \`lastSentAt\` timestamp and logs the code to the console again. If not, it returns a 429 Too Many Requests response with a \`Retry-After\` header.
**Lives in:**
- UI: \`app/verify/page.tsx\`
- Endpoint: \`app/api/auth/resend/route.ts\`

### Step 4 — Sign In

**User:** Enters their email and password on the sign-in page to access their account.
**Frontend sends:** A JSON payload with \`email\` and \`password\`.
**Server does:** Looks up the user by email, compares the provided password against the stored bcrypt hash, and if they match, mints a new database session and issues the session cookie.
**Lives in:** 
- UI: \`app/signin/page.tsx\`
- Endpoint: \`app/api/auth/signin/route.ts\`

### Step 5 — Forgot Password Request

**User:** Visits the forgot password page, enters their registered email, and submits.
**Frontend sends:** A JSON payload containing the \`email\`.
**Server does:** Generates a 64-character secure random token, hashes it with SHA-256, and stores the hash in the database with a 1-hour TTL. It then constructs a reset link containing the raw token and logs it to the console. It deliberately returns a generic success message to prevent user enumeration.
**Lives in:** 
- UI: \`app/forgot-password/page.tsx\`
- Endpoint: \`app/api/auth/forgot-password/route.ts\`

### Step 6 — Reset Password

**User:** Clicks the link in their email and submits a new password on the reset screen.
**Frontend sends:** A JSON payload with the raw \`token\` and the new \`password\`.
**Server does:** Hashes the provided token and looks it up in the database. If it exists and hasn't expired, it hashes the new password with bcrypt, updates the user's record, and invalidates all existing sessions and reset tokens for that user.
**Lives in:** 
- UI: \`app/reset-password/page.tsx\`
- Endpoint: \`app/api/auth/reset-password/route.ts\`

### Step 7 — The Protected Dashboard

**User:** Attempts to visit the application dashboard.
**Frontend sends:** A standard GET request containing the \`sessionId\` cookie.
**Server does:** Reads the cookie and checks the database to ensure the session exists, belongs to a valid user, and hasn't expired. If valid, the user's name is fetched and the dashboard renders. If invalid or missing, it redirects the browser back to the sign-in page.
**Lives in:** \`app/dashboard/page.tsx\`

### Step 8 — Sign Out

**User:** Clicks the "Sign Out" button on the dashboard.
**Frontend sends:** A standard POST request (via a form submission).
**Server does:** Reads the current session cookie, deletes the corresponding session row in the database, clears the browser's cookie, and redirects the user to the sign-in page.
**Lives in:** \`app/api/auth/signout/route.ts\``.split('\n');

    lines.splice(idx3, (idx4 - idx3) + 1, ...sec3);
} else {
    console.log("Could not find section 3 bounds", idx3, idx4);
}

fs.writeFileSync(filepath, lines.join('\n'));
console.log("Done");
