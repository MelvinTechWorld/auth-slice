# Auth Slice

A complete authentication system built as a single working slice — signup, email verification, sign in, password reset, and a protected dashboard. Built for the Product Engineering Bootcamp's Authentication Slice assessment.

See [`DOCUMENTATION.md`](./DOCUMENTATION.md) for the full write-up: how to run it, the data model, the concepts implemented, what went wrong along the way, and the evidence proving each requirement works.

## Quick start

See Section 2 of [`DOCUMENTATION.md`](./DOCUMENTATION.md) for full setup steps, or:

```bash
npm install
cp .env.example .env   # fill in your own DATABASE_URL
npx prisma db push
npm run dev
```

Runs at `http://localhost:3000`.