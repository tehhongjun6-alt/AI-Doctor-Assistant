import pg from 'pg'

export interface UserRecord {
  id: string
  email: string
  passwordHash: string
  displayName: string | null
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>
  create(input: {
    email: string
    passwordHash: string
    displayName?: string | null
  }): Promise<UserRecord>
  recordLogin(id: string): Promise<void>
}

export class EmailTakenError extends Error {
  constructor() {
    super('该邮箱已被注册。')
    this.name = 'EmailTakenError'
  }
}

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super('DATABASE_URL 尚未配置。')
    this.name = 'DatabaseNotConfiguredError'
  }
}

interface UserRow {
  id: string
  email: string
  password_hash: string
  display_name: string | null
}

function toRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name,
  }
}

// 连接 Supabase PostgreSQL（使用 Session pooler 连接字符串）
export function createPgUserRepository(
  connectionString = process.env.DATABASE_URL,
): UserRepository {
  let pool: pg.Pool | undefined

  function getPool() {
    if (!connectionString) throw new DatabaseNotConfiguredError()
    pool ??= new pg.Pool({
      connectionString,
      // Supabase 要求 SSL 连接
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
    })
    return pool
  }

  return {
    async findByEmail(email) {
      const result = await getPool().query<UserRow>(
        'select id, email, password_hash, display_name from public.users where lower(email) = lower($1) limit 1',
        [email],
      )
      return result.rows[0] ? toRecord(result.rows[0]) : null
    },

    async create({ email, passwordHash, displayName }) {
      try {
        const result = await getPool().query<UserRow>(
          'insert into public.users (email, password_hash, display_name) values ($1, $2, $3) returning id, email, password_hash, display_name',
          [email, passwordHash, displayName ?? null],
        )
        return toRecord(result.rows[0])
      } catch (error) {
        // 23505 = unique_violation（邮箱重复）
        if ((error as { code?: string }).code === '23505') {
          throw new EmailTakenError()
        }
        throw error
      }
    },

    async recordLogin(id) {
      await getPool().query(
        'update public.users set last_login_at = now() where id = $1',
        [id],
      )
    },
  }
}
