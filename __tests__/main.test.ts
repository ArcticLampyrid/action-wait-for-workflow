import {wait} from '../src/wait'
import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'
import {expect, test} from '@jest/globals'

test('wait 500 ms', async () => {
    const start = new Date()
    await wait(500)
    const end = new Date()
    var delta = Math.abs(end.getTime() - start.getTime())
    expect(delta).toBeGreaterThan(450)
})
