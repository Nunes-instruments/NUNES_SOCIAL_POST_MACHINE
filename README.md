# NUNES Social Post Machine

Clean standalone Next.js project prepared for a new GitHub repository.

## Upload to your new GitHub account

Create a new repository under:

`https://github.com/aiabishekgv-stack`

Suggested repository name:

`NUNES_SOCIAL_POST_MACHINE`

Upload the **contents of this ZIP to the repository root**.

Do not create an extra `apps/nunes-marketing-live` folder.

## Run locally

```bash
npm install
npm run dev
```

## Deploy on Vercel

1. Vercel → Add New → Project.
2. Import the new GitHub repository.
3. Framework: Next.js.
4. Root Directory: repository root.
5. Add environment variables from `.env.example`.
6. Deploy.

## Required base environment variable

```text
OAUTH_SESSION_SECRET=<long-random-secret>
```

If you attach a Vercel Blob store, Vercel supplies:

```text
BLOB_READ_WRITE_TOKEN
```

## OAuth callback URLs

Replace `YOUR-NEW-APP.vercel.app` with your actual new Vercel domain.

```text
LinkedIn:
https://YOUR-NEW-APP.vercel.app/api/oauth/linkedin/callback

Facebook:
https://YOUR-NEW-APP.vercel.app/api/oauth/facebook/callback

Instagram:
https://YOUR-NEW-APP.vercel.app/api/oauth/instagram/callback

Threads:
https://YOUR-NEW-APP.vercel.app/api/oauth/threads/callback

X:
https://YOUR-NEW-APP.vercel.app/api/oauth/x/callback

Pinterest:
https://YOUR-NEW-APP.vercel.app/api/oauth/pinterest/callback

TikTok:
https://YOUR-NEW-APP.vercel.app/api/oauth/tiktok/callback

YouTube:
https://YOUR-NEW-APP.vercel.app/api/oauth/youtube/callback
```

## Environment variables by platform

LinkedIn:
`LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_AUTHOR_URN`

Facebook / Instagram:
`META_APP_ID`, `META_APP_SECRET`, `FACEBOOK_PAGE_ID`, `INSTAGRAM_USER_ID`

Threads:
`THREADS_APP_ID`, `THREADS_APP_SECRET`

X:
`X_CLIENT_ID`, `X_CLIENT_SECRET`

Pinterest:
`PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`, `PINTEREST_BOARD_ID`

TikTok:
`TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`

YouTube:
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

Bluesky:
`BLUESKY_IDENTIFIER`, `BLUESKY_APP_PASSWORD`

## Security

Never commit actual Client Secrets, access tokens, app passwords, or API keys.

## Current direct-posting support

The package contains direct posting code for LinkedIn, Facebook, X and Bluesky.

Instagram, Threads, Pinterest, TikTok and YouTube can be connected by OAuth, but their final publishing step may require platform-specific media/account setup or provider approval. The UI reports this instead of falsely showing a successful post.
