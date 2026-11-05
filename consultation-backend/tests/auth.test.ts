import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import type { UserRecord, UserRepository } from '../src/auth/userRepository.js'
import { EmailTakenError } from '../src/auth/userRepository.js'

function createMemoryUsers(): UserRepository {
  const users = new Map<string, UserRecord>()
  return {
    async findByEmail(email) {
      return users.get(email.toLowerCase()) ?? null
    },
    async create({ email, passwordHash }) {
      if (users.has(email)) throw new EmailTakenError()
      const user = { id: `user-${users.size + 1}`, email, passwordHash, displayName: null }
      users.set(email, user)
      return user
    },
    async recordLogin() {},
  }
}

describe('auth API', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long'
  })

  it('registers, logs in, and unlocks protected routes', async () => {
    const app = createApp({ userRepository: createMemoryUsers() })

    const register = await request(app)
      .post('/api/auth/register')
      .send({ email: 'Alice@Example.com', password: 'password123' })
    expect(register.status).toBe(201)
    expect(register.body.data.user.email).toBe('alice@example.com')

    const duplicate = await request(app)
      .post('/api/auth/register')
      .send({ email: 'alice@example.com', password: 'password123' })
    expect(duplicate.status).toBe(409)

    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'wrong-password' })
    expect(wrong.status).toBe(401)

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' })
    expect(login.status).toBe(200)
    const token = login.body.data.token as string

    const blocked = await request(app)
      .post('/api/hospitals/nearby')
      .send({ latitude: 100, longitude: 0 })
    expect(blocked.status).toBe(401)

    const allowed = await request(app)
      .post('/api/hospitals/nearby')
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: 100, longitude: 0 })
    expect(allowed.status).toBe(400) // 通过登录验证，进入坐标校验

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
    expect(me.body.data.user.email).toBe('alice@example.com')
  })

  it('rejects short passwords and locks after 5 failed logins', async () => {
    const app = createApp({ userRepository: createMemoryUsers() })

    const weak = await request(app)
      .post('/api/auth/register')
      .send({ email: 'bob@example.com', password: '123' })
    expect(weak.status).toBe(400)

    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'bob@example.com', password: 'nope-nope' })
    }
    const locked = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob@example.com', password: 'nope-nope' })
    expect(locked.status).toBe(429)
  })
})
