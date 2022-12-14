import * as core from '@actions/core'
import * as github from '@actions/github'
import {wait} from './wait'

async function main(): Promise<void> {
    try {
        const token = core.getInput('github_token', {required: true})
        const workflow = core.getInput('workflow', {required: true})
        const [owner, repo] = core.getInput('repo', {required: true}).split('/')
        const waitInterval = Math.max(
            parseInt(core.getInput('wait-interval', {required: true}), 10),
            5
        )
        const sha = core.getInput('sha')
        const branch = core.getInput('branch')
        const event = core.getInput('event')
        const allowedConclusions = core.getMultilineInput(
            'allowed-conclusions',
            {
                required: true
            }
        )

        const client = github.getOctokit(token)
        const params = {
            owner,
            repo,
            workflow_id: workflow,
            head_sha: sha || undefined,
            branch: branch || undefined,
            event: event || undefined
        }
        let first = true
        for (;;) {
            let completed = true
            for await (const runs of client.paginate.iterator(
                client.rest.actions.listWorkflowRuns,
                params
            )) {
                for (const run of runs.data) {
                    if (first) {
                        core.setOutput('run-id', run.id)
                        first = false
                    }
                    if (run.status !== 'completed') {
                        completed = false
                    } else {
                        if (!run.conclusion) {
                            core.setFailed(
                                `Run#${run.id.toString()} is completed without conclusion`
                            )
                            return
                        }
                        if (!allowedConclusions.includes(run.conclusion)) {
                            core.setFailed(
                                `Run#${run.id.toString()} is completed with disallowed conclusion: ${
                                    run.conclusion
                                }`
                            )
                            return
                        }
                    }
                }
            }
            if (completed) {
                break
            }
            await wait(waitInterval * 1000)
        }
    } catch (error) {
        if (error instanceof Error) core.setFailed(error.message)
    }
}

main()
