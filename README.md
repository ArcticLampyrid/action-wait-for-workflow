# Action-Wait-For-Workflow
Wait for a given workflow

```yaml
inputs:
  github_token:
    description: GitHub token
    required: false
    default: ${{ github.token }}
  workflow:
    description: Workflow name.
    required: true
  repo:
    description: Repository name with owner (eg. "ArcticLampyrid/action-wait-for-workflow")
    required: false
    default: ${{ github.repository }}
  sha:
    description: Commit sha
    required: false
  branch:
    description: Branch name
    required: false
  event:
    description: Event type
    required: false
  wait-interval:
    description: "Seconds to wait between polling (at least 5 seconds)"
    required: false
    default: "30"
  allowed-conclusions:
    description: "Array of allowed conclusions"
    required: false
    default: |
      success
```