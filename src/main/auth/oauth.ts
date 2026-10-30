import { shell } from 'electron'
import { randomBytes } from 'crypto'
import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000

const page = (title: string, text: string): string =>
  `<!doctype html><html lang="es"><meta charset="utf-8"><title>${title}</title>` +
  `<body style="font-family:Segoe UI,sans-serif;background:#293737;color:#e8f2ee;display:flex;` +
  `align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center">` +
  `<h2 style="color:#00ff43">${title}</h2><p>${text}</p></div></body></html>`

type LoopbackOptions = {
  // Builds the authorization URL for the given redirect URI and anti-CSRF state.
  buildAuthUrl: (redirectUri: string, state: string) => Promise<string> | string
  // Exchanges the returned code for tokens (and stores them).
  exchange: (code: string, redirectUri: string) => Promise<void>
  timeoutMs?: number
}

// OAuth for desktop apps: system browser + redirect to http://127.0.0.1:<free port>.
export async function authorizeWithLoopback(options: LoopbackOptions): Promise<void> {
  const state = randomBytes(16).toString('hex')
  let server: Server | undefined

  const code = await new Promise<{ code: string; redirectUri: string }>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Authorization timed out')),
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    )
    const finish = (fn: () => void): void => {
      clearTimeout(timer)
      fn()
    }

    server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      if (url.pathname !== '/') {
        res.writeHead(404).end()
        return
      }
      const error = url.searchParams.get('error')
      const received = url.searchParams.get('code')
      if (url.searchParams.get('state') !== state || (!received && !error)) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(page('Solicitud no válida', 'Vuelve a intentarlo desde la aplicación.'))
        return
      }
      if (error || !received) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(page('Autorización cancelada', 'Puedes cerrar esta ventana.'))
        finish(() => reject(new Error('Authorization denied')))
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(page('Cuenta conectada', 'Ya puedes cerrar esta ventana y volver a la aplicación.'))
      const { port } = server!.address() as AddressInfo
      finish(() => resolve({ code: received, redirectUri: `http://127.0.0.1:${port}` }))
    })

    server.on('error', (e) => finish(() => reject(e)))
    server.listen(0, '127.0.0.1', async () => {
      try {
        const { port } = server!.address() as AddressInfo
        const authUrl = await options.buildAuthUrl(`http://127.0.0.1:${port}`, state)
        await shell.openExternal(authUrl)
      } catch (e) {
        finish(() => reject(e))
      }
    })
  }).finally(() => server?.close())

  await options.exchange(code.code, code.redirectUri)
}
