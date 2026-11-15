# Sanity setup

Pomi edits the site at **pomibrow.com/admin**. Everything she can change lives in Sanity:

- services and prices, with cover photos and galleries;
- Learn articles;
- the Safety and Aftercare pages;
- reviews;
- site settings: hours, phone, address, booking link, Instagram grid, bio and headshot.

The site is static. Publishing in the Studio triggers a Cloudflare rebuild, and changes are live
**about two minutes later**. Tell Pomi this so a delay doesn't worry her.

The page designs themselves stay in the code: the home page hero tiles, the About photo and the
studio photo on the contact form. A slot with no photo shows its "Photo to come" frame, as before.

## One-time setup

### 1. Create the project (client's account)

1. At sanity.io, sign up with the studio's email.
2. Create a project named "Pomi B. Brow Studio" with a dataset named `production`. Visibility
   **Public** is fine: the dataset only ever holds what the website shows.
3. Note the **project ID** (8 characters, on sanity.io/manage).

### 2. Allow the Studio to sign in

sanity.io/manage → the project → **API → CORS origins** → add `https://pomibrow.com`, ticking
**Allow credentials**. That is the only origin the Studio runs from.

### 3. Load the current content

The import fills the dataset with exactly what the site shows today, photos included. Then:

1. sanity.io/manage → **API → Tokens → Add API token**. Name it "content import", with
   permissions **Editor**.
2. Run:

   ```sh
   SANITY_PROJECT_ID=<id> SANITY_WRITE_TOKEN=<token> npm run sanity:import
   ```

3. **Delete the token** afterwards.

The import refuses to run against a dataset that already holds these documents, so it cannot
overwrite Pomi's edits. Pass `--force` only to start over deliberately.

### 4. Point the site at the project

In Cloudflare, on the `pomi-brow` Worker: **Settings → Build → Variables and secrets** → add
`PUBLIC_SANITY_PROJECT_ID` = `<id>`. Then redeploy.

### 5. Rebuild on publish

1. **In Cloudflare.** On the `pomi-brow` Worker, go to **Settings → Build → Deploy Hooks**.
   Create a hook named "Sanity publish" on branch `main`, then copy its URL.
2. **In Sanity.** At sanity.io/manage, open the project → **API → Webhooks → Create webhook**:
   - URL: the deploy hook URL
   - Dataset: `production`
   - Trigger on: Create, Update, Delete
   - Filter: `_type in ["service", "learnArticle", "page", "review", "siteSettings"]`
   - HTTP method: POST
   - Leave "Trigger on drafts" off. Only published changes should rebuild the site.

### 6. Give Pomi access

sanity.io/manage → **Members → Invite** with her email. Use the Administrator role, since the
free plan has only Administrator and Viewer. She signs in at `/admin`.

## How photos work

The import uploads every photo the site uses. Each image remembers the repo file it came from,
in a hidden `galleryRef` field. As long as the photo is unchanged, the site keeps serving its own
optimised copy from `src/assets/gallery`, so the import changes nothing visible.

When Pomi replaces a photo, uploads a new one, or draws a crop in the Studio, that image is
served from Sanity's image CDN instead. The CSP already allows `cdn.sanity.io`. The hotspot she
sets becomes the crop point in every frame either way.

## Checking that the import changes nothing

```sh
npm run sanity:parity
```

This builds the site twice: once from the repo's seed content, and once from exactly what the
import would write, served locally by `src/lib/sanity-fixture.ts`. It then compares every page
and fails on any difference. No project or network is needed. Run it after changing the schema
(`cms/schema`), the import, or the content layer (`src/lib/content.ts`).

## If the Studio and the site disagree

- The site only shows **published** documents. A draft in the Studio isn't live yet.
- No rebuild after publishing: check the Sanity webhook's delivery log and the Worker's build list.
- A field left empty in Site settings falls back to the value in
  `src/content/seed/siteSettings.json`.
