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
        const seenRunIds = new Set<number>()
        for (;;) {
            try {
                for await (const runs of client.paginate.iterator(
                    client.rest.actions.listWorkflowRuns,
                    params
                )) {
                    for (const run of runs.data) {
                        if (!seenRunIds.has(run.id)) {
                            seenRunIds.add(run.id)
                            core.info(
                                `Run#${run.id} that meets the filter is found`
                            )
                        }
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
            } catch (e: unknown) {
                const err = e as any // eslint-disable-line @typescript-eslint/no-explicit-any
                const status: number | undefined =
                    err?.response?.status ?? err?.status
                const headers = err?.response?.headers ?? err?.headers
                if (
                    (status === 403 || status === 429) &&
                    headers?.['x-ratelimit-remaining'] === '0'
                ) {
                    // Handle GitHub API rate limiting
                    const resetTimestamp = Number(
                        headers?.['x-ratelimit-reset']
                    )
                    const nowTimestamp = Math.floor(Date.now() / 1000)
                    let waitSec = waitInterval
                    if (Number.isFinite(resetTimestamp)) {
                        waitSec = resetTimestamp - nowTimestamp + 1
                        if (waitSec < waitInterval) waitSec = waitInterval
                    }
                    core.info(
                        `API rate limit reached. Waiting ${waitSec} seconds...`
                    )
                    await wait(waitSec * 1000)
                    continue
                }

                // rethrow if not a handled error
                throw e
            }
            await wait(waitInterval * 1000)
        }
    } catch (error) {
        if (error instanceof Error) core.setFailed(error.message)
    }
}

main()
