import { github } from "../../config/github.js";

export interface CommitContributionByRepository {
  repository: {
    nameWithOwner: string;
    primaryLanguage: { name: string } | null;
  };
  contributions: { totalCount: number };
}

export interface MetricsGraphqlResponse {
  viewer: {
    login: string;
    name: string | null;
    url: string;
    publicRepositories: { totalCount: number };
    privateRepositories: { totalCount: number };
    contributionsCollection: {
      startedAt: string;
      endedAt: string;
      contributionCalendar: { totalContributions: number };
      totalCommitContributions: number;
      totalIssueContributions: number;
      totalPullRequestContributions: number;
      totalPullRequestReviewContributions: number;
      totalRepositoriesWithContributedCommits: number;
      commitContributionsByRepository: CommitContributionByRepository[];
    };
  };
}

const metricsQuery = `
  query AuthenticatedUserMetrics($from: DateTime!, $to: DateTime!) {
    viewer {
      login
      name
      url
      publicRepositories: repositories(privacy: PUBLIC, ownerAffiliations: OWNER, first: 1) {
        totalCount
      }
      privateRepositories: repositories(privacy: PRIVATE, ownerAffiliations: OWNER, first: 1) {
        totalCount
      }
      contributionsCollection(from: $from, to: $to) {
        startedAt
        endedAt
        contributionCalendar { totalContributions }
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        totalRepositoriesWithContributedCommits
        commitContributionsByRepository(maxRepositories: 100) {
          repository {
            nameWithOwner
            primaryLanguage { name }
          }
          contributions { totalCount }
        }
      }
    }
  }
`;

function twoMonthsBefore(date: Date): Date {
  const result = new Date(date);
  const dayOfMonth = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() - 2);
  const lastDayOfMonth = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(dayOfMonth, lastDayOfMonth));
  return result;
}

export async function fetchMetrics(now: Date = new Date()): Promise<MetricsGraphqlResponse> {
  if (Number.isNaN(now.getTime())) {
    throw new Error("The metrics date must be valid");
  }

  return github.graphql<MetricsGraphqlResponse>(metricsQuery, {
    from: twoMonthsBefore(now).toISOString(),
    to: now.toISOString()
  });
}
