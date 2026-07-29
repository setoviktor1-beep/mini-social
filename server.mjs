import { createServer } from 'node:http'
import next from 'next'
import { Server as SocketServer } from 'socket.io'
import Redis from 'ioredis'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = Number(process.env.PORT || 3000)
const app = next({ dev, hostname, port })
const handler = app.getRequestHandler()

await app.prepare()

const server = createServer((request, response) => handler(request, response))
const io = new SocketServer(server, {
  path: '/socket.io',
  cors: {
    origin: process.env.APP_URL || 'https://mini-social.online',
    credentials: true,
  },
})

io.use(async (socket, nextMiddleware) => {
  try {
    const cookie = socket.handshake.headers.cookie
    if (!cookie) return nextMiddleware()
    const response = await fetch(
      `http://127.0.0.1:${port}/api/auth/get-session`,
      { headers: { cookie } },
    )
    if (response.ok) {
      const session = await response.json()
      socket.data.userId = session?.user?.id || null
    }
    nextMiddleware()
  } catch {
    nextMiddleware()
  }
})

if (process.env.REDIS_URL) {
  const subscriber = new Redis(process.env.REDIS_URL)
  await subscriber.subscribe('mini-social:db-change')
  subscriber.on('message', (_channel, raw) => {
    try {
      const event = JSON.parse(raw)
      for (const socket of io.sockets.sockets.values()) {
        if (
          event.audience === null ||
          event.audience.includes(socket.data.userId)
        ) {
          socket.emit('db-change', event)
        }
      }
    } catch (error) {
      console.error('Invalid realtime event', error)
    }
  })
}

server.listen(port, hostname, () => {
  console.log(`Mini Social listening on http://${hostname}:${port}`)
})
