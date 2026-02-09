This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Commentary Cron Jobs

The commentary system now runs scheduled jobs through:

- `POST /api/cron/commentary/daily`
- `POST /api/cron/commentary/weekly`

Both routes require:

- `Authorization: Bearer <CRON_SECRET>`

Environment:

- Set `CRON_SECRET` in your deployment environment.
- If `CRON_SECRET` is not set, routes fall back to `ADMIN_SECRET`.

Vercel schedule:

- `vercel.json` includes:
  - `weekly` job every 6 hours (`0 */6 * * *`)
  - `daily` job at 20:00 UTC (`0 20 * * *`)

Manual run examples:

```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://<your-domain>/api/cron/commentary/daily

curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://<your-domain>/api/cron/commentary/weekly?lobbyId=<lobby-id>"
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
