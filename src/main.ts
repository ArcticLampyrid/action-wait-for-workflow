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
        let sha = core.getInput('sha')
        if (sha === 'auto') {
            const pr_head_sha = github.context.payload.pull_request?.head?.sha
            if (typeof pr_head_sha === 'string' && pr_head_sha.length > 0) {
                sha = pr_head_sha
            } else {
                sha = github.context.sha
            }
            core.info(`Auto detected sha: ${sha}`)
        }
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
        for (;;) {
            for await (const runs of client.paginate.iterator(
                client.rest.actions.listWorkflowRuns,
                params
            )) {
                for (const run of runs.data) {
                    if (run.status === 'completed') {
                        core.setOutput('run-id', run.id)
                        if (!run.conclusion) {
                            core.setFailed(
                                `Run#${run.id.toString()} is completed without conclusion`
                            )
                            return
                        }
                        core.setOutput('run-conclusion', run.conclusion)
                        if (!allowedConclusions.includes(run.conclusion)) {
                            core.setFailed(
                                `Run#${run.id.toString()} is completed with disallowed conclusion: ${
                                    run.conclusion
                                }`
                            )
                            return
                        }
                        core.info(
                            `Run#${run.id.toString()} is completed with conclusion: ${run.conclusion}`
                        )
                        return
                    }
                }
                if (runs.data.length === 0) {
                    core.info(
                        'No runs found in this check round, waiting for next round...'
                    )
                }
            }
            await wait(waitInterval * 1000)
        }
    } catch (error) {
        if (error instanceof Error) core.setFailed(error.message)
    }
}

main()
