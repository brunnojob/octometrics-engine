import type { MetricsGraphqlResponse } from "./fetcher.graphql.js";

export interface ProcessedMetrics {
  timestamp: string;
  period: { from: string; to: string };
  profile: { login: string; name: string | null; url: string };
  repositories: { public: number; private: number; total: number; active: number };
  contributions: { total: number; commits: number; issues: number; pullRequests: number; reviews: number };
  dominantLanguages: Array<{ name: string; repositories: number; commits: number }>;
  languageCoverage: { repositoriesIncluded: number; activeRepositories: number; limit: number };
}

export function processMetrics(raw: MetricsGraphqlResponse, now: Date = new Date()): ProcessedMetrics {
  const { viewer } = raw;
  const contributions = viewer.contributionsCollection;
  const languages = new Map<string, { repositories: number; commits: number }>();

  for (const item of contributions.commitContributionsByRepository) {
    const name = item.repository.primaryLanguage?.name;
    if (!name) continue;

    const entry = languages.get(name) ?? { repositories: 0, commits: 0 };
    entry.repositories += 1;
    entry.commits += item.contributions.totalCount;
    languages.set(name, entry);
  }

  return {
    timestamp: now.toISOString(),
    period: { from: contributions.startedAt, to: contributions.endedAt },
    profile: { login: viewer.login, name: viewer.name, url: viewer.url },
    repositories: {
      public: viewer.publicRepositories.totalCount,
      private: viewer.privateRepositories.totalCount,
      total: viewer.publicRepositories.totalCount + viewer.privateRepositories.totalCount,
      active: contributions.totalRepositoriesWithContributedCommits
    },
    contributions: {
      total: contributions.contributionCalendar.totalContributions,
      commits: contributions.totalCommitContributions,
      issues: contributions.totalIssueContributions,
      pullRequests: contributions.totalPullRequestContributions,
      reviews: contributions.totalPullRequestReviewContributions
    },
    dominantLanguages: [...languages.entries()]
      .map(([name, data]) => ({ name, ...data }))
      .sort((left, right) => right.commits - left.commits || left.name.localeCompare(right.name)),
    languageCoverage: {
      repositoriesIncluded: contributions.commitContributionsByRepository.length,
      activeRepositories: contributions.totalRepositoriesWithContributedCommits,
      limit: 100
    }
  };
}
