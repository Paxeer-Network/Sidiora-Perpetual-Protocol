# List Pending Review PRs

Find all open PRs from team members that need Code Owner review or additional approvals.

## No Arguments Required

This command runs with predefined team member list and Code Owners.

## Configuration

**Team Members** (PR Authors):
Configure your team members list here (comma-separated GitHub usernames)

**Code Owners** (from `.github/CODEOWNERS`):
Configure your code owners list here (comma-separated GitHub usernames)

## Workflow Steps

1. **Fetch open PRs for all team members**
   - For each team member:
     - Run `gh pr list --author <author> --state open --json number,title,url,isDraft,author,createdAt,reviews,labels --limit 100`
   - Combine all results
   - Exclude draft PRs (`isDraft: true`)
   - Exclude PRs with label `request codereview`

2. **Check CI and merge status for each PR**
   - Run `gh pr view <number> --json mergeable,mergeStateStatus,statusCheckRollup`
   - Detect conflicts (`mergeable: "CONFLICTING"`)
   - Detect CI failures (any check with `conclusion: "FAILURE"`)

3. **Analyze review status for each PR**
   - Get the list of reviewers who have APPROVED
   - Check if any Code Owner has approved
   - Count total approvals

4. **Categorize PRs into two groups**:

   **Group 1: Missing Code Owner Review**
   - PRs where NO Code Owner has approved yet
   - These are highest priority - need Code Owner attention

   **Group 2: Need More Approvals**
   - PRs where at least 1 Code Owner has approved
   - But total approvals < 2
   - These need one more approval to merge

5. **Generate report**
   - Output directly to console (do NOT save to file)
   - Use Slack-friendly format with clickable links
   - Add blank line between sections
   - Format: `• [#number title](url) - author (approvers) status`
   - Add status indicators only for issues:
     - `❌ Conflict` - has merge conflicts
     - `💥 CI Failed` - CI checks failed
   - Sort by created date (oldest first - highest priority)

## Example Usage

```bash
/pending-reviews
```

## Example Output

```
**Pending Review PRs - 2025-01-13**

**Missing Code Owner Review (3)**
• [#9638 feat(components): add description prop to Popover](url) - author1
• [#9637 fix(feature): restore filter and export buttons](url) - author2
• [#9636 fix(feature): remove alert](url) - author3 ❌ Conflict

**Need More Approvals (2)**
• [#9646 fix(feature): use correct icon](url) - author1 (1✓ codeowner1)
• [#9648 fix: only bold current status](url) - author2 (1✓ codeowner1) 💥 CI Failed
```

## Filtering Rules

- Only non-draft, open PRs are included
- PRs with label `request codereview` are excluded
- PRs with 2+ approvals are excluded (ready to merge, no action needed)
- Sorted by creation date to prioritize older PRs

## Status Indicators

- `(1✓ username)` - has 1 approval from Code Owner
- `❌ Conflict` - has merge conflicts, author needs to resolve
- `💥 CI Failed` - CI checks failed, author needs to fix
- No indicator = CI passing, no conflicts
