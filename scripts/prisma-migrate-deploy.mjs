import { spawnSync } from 'node:child_process'

const env = { ...process.env }

if (!env.DIRECT_URL) {
  if (!env.DATABASE_URL) {
    console.error('Missing DATABASE_URL. Unable to run prisma migrate deploy.')
    process.exit(1)
  }

  env.DIRECT_URL = env.DATABASE_URL
  console.warn('DIRECT_URL is not set. Falling back to DATABASE_URL for prisma migrate deploy.')
}

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const result = spawnSync(npxCommand, ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env,
})

process.exit(result.status ?? 1)
