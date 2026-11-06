import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { signToken } from '../src/auth/token.js'
import { hashPassword } from '../src/auth/password.js'
import { createMemoryUserRepository } from '../src/auth/userRepository.js'
import { createMemoryConversationRepository } from '../src/services/conversationRepository.js'

describe('account deletion API (Step 7)', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long'
  })

  it('rejects with 400 PASSWORD_REQUIRED when password is not provided', async () => {
    const userRepo = createMemoryUserRepository()
    const convRepo = createMemoryConversationRepository()
    const app = createApp({
      userRepository: userRepo,
      conversationRepository: convRepo,
    })

    const user = await userRepo.create({
      email: 'user1@example.com',
      passwordHash: await hashPassword('Secret123'),
    })
    const token = signToken(user).token

    const res = await request(app)
      .delete('/api/account')
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('PASSWORD_REQUIRED')

    // Verify user is NOT deleted
    const found = await userRepo.findByEmail('user1@example.com')
    expect(found).not.toBeNull()
  })

  it('rejects with 401 WRONG_PASSWORD and deletes nothing when password is incorrect', async () => {
    const userRepo = createMemoryUserRepository()
    const convRepo = createMemoryConversationRepository()
    const app = createApp({
      userRepository: userRepo,
      conversationRepository: convRepo,
    })

    const user = await userRepo.create({
      email: 'user2@example.com',
      passwordHash: await hashPassword('Secret123'),
    })
    const conv = await convRepo.createIfUnderLimit(user.id, '对话')
    await convRepo.appendTurn({
      conversationId: conv!.id,
      userId: user.id,
      userMessage: '测试消息',
      assistantAnswer: {
        summary: '回答',
        followUpQuestions: [],
        possibleCauses: [],
        advice: [],
        urgency: 'low',
        seekCareWhen: [],
        disclaimer: '免责',
      },
    })

    const token = signToken(user).token

    const res = await request(app)
      .delete('/api/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'wrong-password' })

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('WRONG_PASSWORD')

    // Absolutely nothing deleted
    const foundUser = await userRepo.findByEmail('user2@example.com')
    expect(foundUser).not.toBeNull()

    const convs = await convRepo.listByUser(user.id)
    expect(convs).toHaveLength(1)
  })

  it('deletes user and all conversations with 204 on correct password, leaving other user intact', async () => {
    const userRepo = createMemoryUserRepository()
    const convRepo = createMemoryConversationRepository()
    const app = createApp({
      userRepository: userRepo,
      conversationRepository: convRepo,
    })

    // User A
    const userA = await userRepo.create({
      email: 'usera@example.com',
      passwordHash: await hashPassword('PasswordA!'),
    })
    const convA = await convRepo.createIfUnderLimit(userA.id, 'User A 对话')
    await convRepo.appendTurn({
      conversationId: convA!.id,
      userId: userA.id,
      userMessage: 'User A 问题',
      assistantAnswer: {
        summary: 'User A 回答',
        followUpQuestions: [],
        possibleCauses: [],
        advice: [],
        urgency: 'low',
        seekCareWhen: [],
        disclaimer: '免责',
      },
    })

    // User B (the other user)
    const userB = await userRepo.create({
      email: 'userb@example.com',
      passwordHash: await hashPassword('PasswordB!'),
    })
    const convB = await convRepo.createIfUnderLimit(userB.id, 'User B 对话')
    await convRepo.appendTurn({
      conversationId: convB!.id,
      userId: userB.id,
      userMessage: 'User B 问题',
      assistantAnswer: {
        summary: 'User B 回答',
        followUpQuestions: [],
        possibleCauses: [],
        advice: [],
        urgency: 'low',
        seekCareWhen: [],
        disclaimer: '免责',
      },
    })

    const tokenA = signToken(userA).token

    // Delete User A's account
    const res = await request(app)
      .delete('/api/account')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ password: 'PasswordA!' })

    expect(res.status).toBe(204)

    // User A and their conversations are gone
    const foundUserA = await userRepo.findByEmail('usera@example.com')
    expect(foundUserA).toBeNull()

    const convsA = await convRepo.listByUser(userA.id)
    expect(convsA).toHaveLength(0)

    // User B and their conversations are still intact!
    const foundUserB = await userRepo.findByEmail('userb@example.com')
    expect(foundUserB).not.toBeNull()
    expect(foundUserB?.email).toBe('userb@example.com')

    const convsB = await convRepo.listByUser(userB.id)
    expect(convsB).toHaveLength(1)
    expect(convsB[0].title).toBe('User B 对话')
  })

  it('rate limits after 5 failed password attempts with 429', async () => {
    const userRepo = createMemoryUserRepository()
    const convRepo = createMemoryConversationRepository()
    const app = createApp({
      userRepository: userRepo,
      conversationRepository: convRepo,
    })

    const user = await userRepo.create({
      email: 'rate-limit-user@example.com',
      passwordHash: await hashPassword('CorrectPassword!'),
    })
    const token = signToken(user).token

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .delete('/api/account')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'WrongPassword' })
      expect(res.status).toBe(401)
    }

    const lockedRes = await request(app)
      .delete('/api/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'CorrectPassword!' })

    expect(lockedRes.status).toBe(429)
    expect(lockedRes.body.error.code).toBe('TOO_MANY_ATTEMPTS')
  })
})
