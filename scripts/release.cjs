// Publishes the current version (package.json) as a GitHub release: `npm run release`.
//
// electron-builder uploads the installer and its helper file in parallel, and when the release does
// not exist yet both try to create it at the same moment: one wins and the other fails with
// "already_exists", leaving a half-published release. So the release is created here first, once,
// and electron-builder only has to upload the files to it.
const { spawnSync } = require('child_process')
const { readFileSync } = require('fs')
const { join } = require('path')

const root = join(__dirname, '..')
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const config = readFileSync(join(root, 'electron-builder.yml'), 'utf8')
const owner = /^\s*owner:\s*(\S+)/m.exec(config)?.[1]
const repo = /^\s*repo:\s*(\S+)/m.exec(config)?.[1]
const token = process.env.GH_TOKEN
const tag = `v${version}`

function fail(message) {
  console.error(`\n  ✖ ${message}\n`)
  process.exit(1)
}

if (!owner || !repo)
  fail('No se encontró owner/repo en la sección publish de electron-builder.yml.')
if (!token) fail('Falta la variable GH_TOKEN (ver "Publicar una versión" en el README).')

const api = (path, options = {}) =>
  fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    }
  })

async function ensureRelease() {
  const existing = await api(`/releases/tags/${tag}`)
  if (existing.ok) {
    console.log(`  • la release ${tag} ya existe: se le suben los archivos que falten`)
    return
  }
  if (existing.status !== 404)
    fail(`GitHub respondió ${existing.status} al buscar la release ${tag}.`)

  const created = await api('/releases', {
    method: 'POST',
    body: JSON.stringify({ tag_name: tag, name: version, draft: false, prerelease: false })
  })
  if (!created.ok) {
    const detail = await created.text()
    fail(`No se pudo crear la release ${tag} (${created.status}): ${detail.slice(0, 300)}`)
  }
  console.log(`  • release ${tag} creada en ${owner}/${repo}`)
}

async function main() {
  console.log(`\n  Publicando la versión ${version}`)
  await ensureRelease()

  // Same steps as `npm run build`, then build the installer and upload it to the release.
  const shell = process.platform === 'win32'
  for (const [command, args] of [
    ['npm', ['run', 'build']],
    ['npx', ['electron-builder', '--win', '--publish', 'always']]
  ]) {
    const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell })
    if (result.status !== 0) fail(`Falló: ${command} ${args.join(' ')}`)
  }
  console.log(
    `\n  ✔ Versión ${version} publicada: https://github.com/${owner}/${repo}/releases/tag/${tag}\n`
  )
}

main().catch((error) => fail(error.message))
