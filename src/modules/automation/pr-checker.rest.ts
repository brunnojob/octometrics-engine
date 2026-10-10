import { github } from "../../config/github.js";

export interface PullRequestReport {
  repository: string;
  pullNumber: number;
  url: string;
  state: "open" | "merged" | "closed";
  headSha: string;
  mergeable: boolean | null;
  mergeableState: string;
  draft: boolean;
  checks: {
    total: number;
    passed: number;
    pending: number;
    failed: number;
    runs: Array<{ name: string; status: string; conclusion: string | null }>;
  };
  commitStatuses: { state: string; total: number };
  readyToMerge: boolean;
  reasons: string[];
}

export async function checkPullRequest(owner: string, repo: string, pull_number: number): Promise<PullRequestReport> {
  if (!owner.trim() || !repo.trim() || !Number.isSafeInteger(pull_number) || pull_number < 1) {
    throw new Error("A repository owner, name, and positive pull request number are required");
  }

  const { data: pull } = await github.rest.pulls.get({ owner, repo, pull_number });
  const headSha = pull.head.sha;
  const [checkRuns, statusResponse] = await Promise.all([
    github.paginate(github.rest.checks.listForRef, { owner, repo, ref: headSha, per_page: 100 }),
    github.rest.repos.getCombinedStatusForRef({ owner, repo, ref: headSha, per_page: 100 })
  ]);

  const passedConclusions = new Set(["success", "neutral", "skipped"]);
  const failed = checkRuns.filter((run) => run.status === "completed" && !passedConclusions.has(run.conclusion ?? ""));
  const pending = checkRuns.filter((run) => run.status !== "completed");
  const passed = checkRuns.length - failed.length - pending.length;
  const state = pull.merged ? "merged" : pull.state === "open" ? "open" : "closed";
  const status = statusResponse.data;
  const reasons: string[] = [];

  if (state !== "open") reasons.push(`Pull request is ${state}`);
  if (pull.draft) reasons.push("Pull request is a draft");
  if (pull.mergeable === null) reasons.push("GitHub is still calculating mergeability");
  if (pull.mergeable === false) reasons.push("Pull request has merge conflicts or cannot be merged");
  if (pull.mergeable_state !== "clean") reasons.push(`Merge state is ${pull.mergeable_state}`);
  if (failed.length > 0) reasons.push(`${failed.length} check run(s) failed`);
  if (pending.length > 0) reasons.push(`${pending.length} check run(s) pending`);
  if (status.total_count > 0 && status.state !== "success") {
    reasons.push(`Commit status is ${status.state}`);
  }

  return {
    repository: `${owner}/${repo}`,
    pullNumber: pull_number,
    url: pull.html_url,
    state,
    headSha,
    mergeable: pull.mergeable,
    mergeableState: pull.mergeable_state,
    draft: pull.draft ?? false,
    checks: {
      total: checkRuns.length,
      passed,
      pending: pending.length,
      failed: failed.length,
      runs: checkRuns.map((run) => ({ name: run.name, status: run.status, conclusion: run.conclusion }))
    },
    commitStatuses: { state: status.state, total: status.total_count },
    readyToMerge: reasons.length === 0,
    reasons
  };
}
