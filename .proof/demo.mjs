import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { createWebhookApp } from '../dist/modules/webhooks/index.js';
import { processMetrics } from '../dist/modules/metrics/processor.js';

const secret = 'local-execution-proof-only';
const server = createWebhookApp(secret).listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
async function request(name, body, expected, signature = true, event = 'pull_request', type = 'application/json') {
  const headers = { 'content-type': type, 'x-github-event': event, 'x-github-delivery': `proof-${name}` };
  if (signature) headers['x-hub-signature-256'] = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
  const response = await fetch(base + '/webhook', { method: 'POST', headers, body });
  const result = await response.json();
  assert.equal(response.status, expected, name);
  console.log(JSON.stringify({ test: name, status: response.status, response: result }));
  return result;
}
try {
  const payload = { action: 'closed', number: 1, repository: { full_name: 'brunnojob/octometrics-engine' }, pull_request: { merged: true } };
  assert.equal((await request('merged', JSON.stringify(payload), 200)).outcome, 'merged');
  payload.pull_request.merged = false;
  assert.equal((await request('closed', JSON.stringify(payload), 200)).outcome, 'closed');
  await request('unsigned', JSON.stringify(payload), 401, false);
  await request('signed-invalid-json', '{', 400);
  await request('signed-invalid-payload', '{}', 400);
  await request('ignored-event', '{}', 202, true, 'push');
  await request('wrong-content-type', '{}', 415, true, 'push', 'text/plain');
  const response = await fetch(base + '/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=' + '0'.repeat(64) }, body: JSON.stringify(payload) });
  assert.equal(response.status, 401);
  console.log(JSON.stringify({ test: 'tampered-signature', status: response.status }));
} finally {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

const raw = { viewer: { login: 'fixture-user', name: null, url: 'https://github.com/fixture-user', publicRepositories: { totalCount: 3 }, privateRepositories: { totalCount: 0 }, contributionsCollection: { startedAt: '2026-08-10T00:00:00Z', endedAt: '2026-10-10T00:00:00Z', contributionCalendar: { totalContributions: 12 }, totalCommitContributions: 9, totalIssueContributions: 1, totalPullRequestContributions: 1, totalPullRequestReviewContributions: 1, totalRepositoriesWithContributedCommits: 3, commitContributionsByRepository: [ { repository: { nameWithOwner: 'fixture/a', primaryLanguage: { name: 'C' } }, contributions: { totalCount: 3 } }, { repository: { nameWithOwner: 'fixture/b', primaryLanguage: { name: 'Java' } }, contributions: { totalCount: 6 } }, { repository: { nameWithOwner: 'fixture/c', primaryLanguage: null }, contributions: { totalCount: 0 } } ] } } };
const result = processMetrics(raw, new Date('2026-10-10T00:00:00Z'));
assert.deepEqual(result.dominantLanguages, [{ name: 'Java', repositories: 1, commits: 6 }, { name: 'C', repositories: 1, commits: 3 }]);
assert.equal(result.repositories.total, 3);
assert.equal(result.contributions.total, 12);
assert.equal(result.languageCoverage.repositoriesIncluded, 3);
console.log(JSON.stringify({ test: 'metrics-processor-with-explicit-fixture', languages: result.dominantLanguages, total: result.contributions.total }));
