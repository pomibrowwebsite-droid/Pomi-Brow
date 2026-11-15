# Instagram feed: setup and how it stays current

The home page's "Recent work" section shows Pomi's four newest Instagram posts. Once the
one-time setup below is done, it updates itself: no rebuilds, nothing for anyone to do.

## How it works

1. The home page is built with four photos picked in Sanity (Site settings → Instagram grid).
   Search engines and visitors without JavaScript see those.
2. On load, a small script asks the site's own endpoint, `/api/instagram`, for the newest posts.
3. That endpoint is a Cloudflare Pages Function (`functions/api/instagram.ts`). It calls Meta's
   Instagram API with Pomi's token, keeps the answer in Cloudflare's edge cache for one hour,
   and returns the four newest posts.
4. The script swaps the picked photos for the live posts. Each tile shows the post's image
   straight from Instagram, a caption with the post date, and links to the post.
5. If anything fails (no token yet, Meta down, token expired), the picked photos stay. The
   section is never hidden and never looks broken.

A new post appears on the site within an hour of Pomi publishing it. Meta's tokens expire
after 60 days, so once a week the function exchanges the current token for a fresh one and
stores it in a KV namespace. With the KV binding in place the token never needs touching again.

This is not an "embed" in the iframe sense. Meta's embed widget can only show one post whose
URL you already know; it cannot list the newest posts. The site renders its own tiles from
the API so they match the design.

## One-time setup

### 1. Make the Instagram account a professional account

In the Instagram app: Settings → Account type and tools → Switch to professional account.
Creator or Business both work. Personal accounts have no API access at all.

### 2. Create the Meta app and generate a token

Log in at https://developers.facebook.com with a Facebook account.

1. My Apps → Create app. Choose the "Other" use case, then the "Business" app type.
2. In the app dashboard, add the **Instagram** product.
3. Open Instagram → **API setup with Instagram login**. Under "Generate access tokens", add
   @pomib.browstudio as an Instagram tester.
4. Pomi accepts the invite in the Instagram app: Settings → Website permissions → Tester invites.
5. Back in the dashboard, click **Generate token** next to her account and log in as her.
   Copy the token. It is long-lived and valid for 60 days.

The app can stay in development mode. Reading the account's own posts does not need App Review.

### 3. Configure Cloudflare Pages

In the Pages project for the site:

1. Settings → Environment variables → add `INSTAGRAM_ACCESS_TOKEN` with the token. Mark it
   encrypted. Set it for Production (and Preview if you want preview deploys to show the feed).
2. Workers & Pages → KV → Create a namespace. Any name, for example `pomi-instagram`.
3. Back in the Pages project: Settings → Functions → KV namespace bindings → Add binding.
   Variable name `INSTAGRAM_KV`, select the namespace you just created.

Optional: `INSTAGRAM_HANDLE` sets the handle used in fallback alt text. It defaults to
`pomib.browstudio`.

### 4. Deploy and check

Redeploy so the new variables apply, then open:

```
https://pomibrow.com/api/instagram
```

Expected: JSON with `"ok":true`, four posts, and `"refresh":"auto"`.

| You see | Meaning | Fix |
|---|---|---|
| `"error":"not-configured"` | The token variable is not set | Step 3.1 |
| `"refresh":"manual"` | Feed works, but no KV binding, so the token will die at 60 days | Step 3.2 and 3.3 |
| `"error":"upstream"` | Meta rejected the request | Token expired or revoked: generate a new one (step 2.5) and update the variable |

Then open the home page and scroll to "Recent work". The four tiles should be Pomi's newest
posts, each linking to the post on Instagram.

## Things to know

- **First 24 hours.** Meta will not refresh a token younger than a day. For the first day
  after generating one, the function's log shows `Instagram responded 400` once a week's
  worth of cache misses go by. That is expected and harmless.
- **Replacing the token.** Paste the new one into the environment variable and redeploy.
  The function notices the change and starts over from the new token; the old KV record is
  ignored.
- **Turning it off.** In Sanity, Site settings → "Show the newest Instagram posts
  automatically". Off means the four picked photos show instead. The picked photos are also
  what shows whenever the feed cannot load, so keep them current-ish.
- **Fewer than four posts.** If Meta omits an image for a post (it does this for some Reels
  with licensed music), the function asks for extra posts so the grid still fills.
- **The token is a secret.** It lives only in Cloudflare. Never put it in Sanity, the seed
  JSON, or a commit. Sanity's free dataset is public.

## Local development

`astro dev` cannot run Pages Functions, so `astro.config.mjs` serves `/api/instagram` itself
in dev:

- With `INSTAGRAM_ACCESS_TOKEN` in a local `.env` (gitignored), it calls Meta for real.
- Without a token, it serves `tests/fixtures/instagram-media.json`, a sample using local
  gallery photos. The sample's tiles link to the profile, since sample posts have no real URL.

Restart the dev server after changing `.env`; it does not reload environment variables on
its own. Run `npm test` for the feed's unit tests (`tests/instagram.test.ts`).
