#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import process from 'node:process'

const baseUrl = process.env.SMH_CONTROL_URL || 'http://127.0.0.1:48561'
const args = process.argv.slice(2)
const jsonOutput = takeFlag('--json')

function takeFlag(flag) {
  const index = args.indexOf(flag)
  if (index === -1) return false
  args.splice(index, 1)
  return true
}

function usage() {
  console.log(`ShowMeHow CLI

Usage:
  smh-cli health
  smh-cli projects [--json]
  smh-cli state [--json]
  smh-cli open-project <name-or-id>
  smh-cli get-script
  smh-cli push-script <file>
  smh-cli push-script --stdin
  smh-cli load-sample
  smh-cli validate
  smh-cli play
  smh-cli pause
  smh-cli resume
  smh-cli restart
  smh-cli stop
  smh-cli next-step

Environment:
  SMH_CONTROL_URL   Override control server URL (default: ${baseUrl})
`)
}

async function request(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || `Request failed with ${response.status}`)
  }

  return data
}

async function sendCommand(command) {
  return request('POST', '/command', command)
}

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks.map((chunk) => (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))).toString('utf8')
}

function print(data) {
  if (jsonOutput) {
    console.log(JSON.stringify(data, null, 2))
    return
  }

  if (typeof data === 'string') {
    process.stdout.write(data)
    if (!data.endsWith('\n')) process.stdout.write('\n')
    return
  }

  console.log(JSON.stringify(data, null, 2))
}

async function main() {
  const command = args.shift()

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    usage()
    return
  }

  switch (command) {
    case 'health':
      print(await request('GET', '/health'))
      return

    case 'projects': {
      const data = await request('GET', '/projects')
      if (jsonOutput) {
        print(data)
        return
      }

      for (const project of data.projects || []) {
        const current = project.id === data.currentProjectId ? '*' : ' '
        console.log(`${current} ${project.id}\t${project.name}\t${project.rootPath}`)
      }
      return
    }

    case 'state':
      print(await request('GET', '/state'))
      return

    case 'open-project': {
      const target = args.shift()
      if (!target) throw new Error('Missing project name or id')
      const numericId = Number(target)
      const payload = Number.isFinite(numericId) && String(numericId) === target ? { type: 'open-project', projectId: numericId } : { type: 'open-project', projectName: target }
      print(await sendCommand(payload))
      return
    }

    case 'get-script': {
      const data = await request('GET', '/script')
      if (jsonOutput) {
        print(data)
      } else {
        print(data.script || '')
      }
      return
    }

    case 'push-script': {
      const target = args.shift()
      let script = ''

      if (target === '--stdin' || target === '-') {
        script = await readStdin()
      } else if (target) {
        script = await readFile(target, 'utf8')
      } else {
        throw new Error('Missing file path or --stdin')
      }

      print(await sendCommand({ type: 'set-script', script }))
      return
    }

    case 'load-sample':
      print(await sendCommand({ type: 'load-sample' }))
      return

    case 'validate':
      print(await sendCommand({ type: 'validate' }))
      return

    case 'play':
    case 'pause':
    case 'resume':
    case 'restart':
    case 'stop':
    case 'next-step':
      print(await sendCommand({ type: command }))
      return

    default:
      throw new Error(`Unknown command: ${command}`)
  }
}

main().catch((error) => {
  console.error(`smh-cli error: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
