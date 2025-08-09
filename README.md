# Action: Wait For Workflow
Wait (poll) until a specific GitHub Actions workflow run (in this or another repository) finishes, then proceed. Useful for composing workflows that must respect upstream build / test / cache / deploy ordering without converting everything to a monolithic workflow.

## Quick Start
Wait for the latest run (same repository & triggering commit) of `build.yml` and require success:
```yaml
- uses: ArcticLampyrid/action-wait-for-workflow@v1
  with:
    workflow: build.yml
```
That is all you need in the common case.

## Key Concepts
- Polling: The action periodically (every `wait-interval` seconds) lists runs of the target workflow via the REST API until it finds the first matching run that has `status: completed`.
- Filtering: You can narrow the search with `sha`, `branch`, `event`. (by default, we only filter by the same triggering commit).
- Validation: When a completed run is found, its `conclusion` must be in `allowed-conclusions` (allowed by default: `success`).
- Outputs: `run-id`, `run-conclusion` for downstream steps.

## Alternative Approaches (When You Might Not Need This Action)
Native, event‑driven triggers can sometimes remove the need to poll:
- `workflow_run`: Automatically starts a downstream workflow when another finishes. Great for simple linear hand‑offs.
- `check_run`: Fires on check status changes. Can be noisy; usually requires additional filtering logic.

Limitations of relying only on these events:
- Workflow file location: The downstream workflow must already exist on the default branch or the event will not trigger a run.
- Check association: Harder to explicitly define that a downstream workflow is a check for a specific commit / PR.
- Cross‑repo flexibility: Event triggers across repositories may not align with your required sequencing granularity or permission setup.

Use this action when you need explicit, queryable intent: “block here until the latest matching run of workflow <file> meeting these filters completes with an allowed conclusion.”

## Definitions
### Inputs
```yaml
- name: Wait for build workflow
  uses: ArcticLampyrid/action-wait-for-workflow@<tag>
  with:
    workflow: <file name>          # required, e.g. build.yml
    repo: owner/repo               # default: current repo
    sha: auto | <sha>              # auto (default) = triggering commit for current run
    branch: <branch-name>          # empty (default) = no branch filter
    event: <event-type>            # empty (default) = no event filter
    wait-interval: 30              # seconds (min 5)
    allowed-conclusions: |         # succeeds if conclusion is allowed, and fails if not
      success
```

### Outputs
```yaml
run-id: <number>
run-conclusion: <string>
```

## Scenario Cookbook
### Same Commit (Basic)
Shown in Quick Start:
```yaml
with:
  workflow: build.yml
```
Details: For pull requests the action uses the PR head commit (not the synthetic merge commit). This ensures it waits for the run actually triggered by the PR. (See Issue #171)

### Latest Run on PR Base Branch
Wait for the latest successful run of the workflow on the base branch at the exact base commit:
```yaml
with:
  workflow: build.yml
  branch: ${{ github.event.pull_request.base.ref }}
  sha: ${{ github.event.pull_request.base.sha }}
```
Useful when downstream logic depends on the state of the base branch rather than the PR head.

### Cross Repository
Wait on a workflow in another repository:
```yaml
with:
  workflow: reusable-build.yml
  repo: other-owner/other-repo
  branch: main
```
Use a token (e.g. a PAT) with `actions:read` on the target repo.

### Filter by Event
Disambiguate when the same commit triggered multiple event types (`push`, `pull_request`, `merge_group`, etc.):
```yaml
with:
  workflow: build.yml
  event: merge_group
```
Or always key off the current workflow’s triggering event:
```yaml
with:
  workflow: build.yml
  event: ${{ github.event_name }}
```

### Timeout & Fallback Pattern
No dedicated `timeout` input. Use a step‑level timeout plus a fallback step:
```yaml
jobs:
  wait-upstream:
    steps:
      - id: wait
        uses: ArcticLampyrid/action-wait-for-workflow@v1
        timeout-minutes: 15
        with:
          workflow: cache-populator.yml
      - if: failure() || cancelled()
        run: echo 'Proceeding without fresh cache'
```
If the wait step times out, subsequent logic can choose to proceed with degraded behavior. (See Issue #185)
