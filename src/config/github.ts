import "dotenv/config";
import { Octokit } from "octokit";

const token = process.env.GITHUB_TOKEN?.trim();

if (!token) {
  throw new Error("GITHUB_TOKEN is required");
}

export const github = new Octokit({ auth: token });
