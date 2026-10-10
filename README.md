# OctoMetrics Engine

Typed Node.js service for collecting GitHub account contributions and receiving verified pull request webhooks. The metrics command writes structured JSON to standard output. The webhook server records merged and closed pull requests as structured JSON logs.

## Prerequisites

- Node.js 20 or newer
- npm (included with Node.js), or pnpm
- A GitHub token with access to the repositories being measured (`read:user` and `repo` for classic tokens when private contributions are needed; equivalent read permissions for fine-grained tokens)

## Installation

```bash
npm install
cp .env.example .env
```

In Windows PowerShell, run `Copy-Item .env.example .env` instead. Keep `.env` in the project root, next to `package.json`.
If you already have pnpm installed, you can use `pnpm install` instead of `npm install`.

Create `.env` from `.env.example` and replace the example values:

```dotenv
GITHUB_TOKEN=your_personal_access_token
WEBHOOK_SECRET=your_random_secret
PORT=3000
```

Generate `GITHUB_TOKEN` while signed in to the GitHub account being measured: open [Personal access tokens](https://github.com/settings/tokens), choose **Tokens (classic)**, then **Generate new token (classic)**. Set an expiration and grant `read:user`. Add `repo` if you need access to private repositories or want to inspect private pull requests. Copy the generated token into `.env`. A fine-grained token with the corresponding account and repository read permissions is also supported, but access to private contribution data depends on the granted permissions.

`WEBHOOK_SECRET` is a separate value that you create yourself. For example, generate one locally with Node.js:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy that value into `.env`. In the GitHub repository, open **Settings → Webhooks → Add webhook**. Set the public HTTPS payload URL to `https://your-host.example/webhook`, choose `application/json`, paste **the same** value into the **Secret** field, and subscribe to **Pull requests** events. A local server needs a public HTTPS endpoint or tunnel before GitHub can deliver webhooks to it. The webhook server can run without `GITHUB_TOKEN`. Set `PORT` if it should listen on a port other than `3000`. Never commit `.env`, a real token, or the webhook secret.

## Build and run

```bash
npm run typecheck
npm run build
npm run start:metrics
npm run start:webhooks
```

`start:metrics` and `start:webhooks` run the compiled files in `dist`. Build after changing source files. For local development without a build, use `npm run dev:metrics` or `npm run dev:webhooks`. Every command in this section also works with `pnpm run` if pnpm is installed.

## Metrics schema

The GraphQL query covers the two-month window ending at execution time. It reports the authenticated profile, counts of owned public and private repositories, contribution totals, and the number of repositories with commit contributions. `dominantLanguages` ranks primary repository languages by commits attributed to the user. The query requests at most 100 repositories in `commitContributionsByRepository`; `languageCoverage` shows how much of the active repository count that ranking covers. Repositories without a primary language are excluded from the language ranking. Private contributions and repository counts depend on token permissions and account visibility.

## Pull request checks

Import `checkPullRequest(owner, repo, pull_number)` from `dist/modules/automation/pr-checker.rest.js`. It returns the PR state, head commit check runs and commit status, GitHub mergeability, reasons for blocking, and a conservative `readyToMerge` flag. A `null` mergeability value means GitHub is still computing it; call again later. Merge policies can include rules beyond those summarized here, so the flag is a snapshot of the API response, not an attempt to merge.

## Webhook responses

`POST /webhook` verifies `X-Hub-Signature-256` against the exact request bytes before parsing JSON. It returns `200` for valid closed or merged pull requests, `202` for other valid events, `400` for invalid payloads, `401` for a bad signature, and `415` for a non-JSON content type. Successful deliveries are logged with timestamp, delivery ID, repository, PR number, and outcome. Put the service behind HTTPS when exposing it publicly.

## Co-authorship

Contribution trailer:

```text
Co-authored-by: nyctophile <33561761+ineedfoundmyway@users.noreply.github.com>
```
