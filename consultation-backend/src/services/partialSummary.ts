/**
 * 从尚未生成完的 JSON 文本中取出 summary 字段已生成的部分。
 * 模型按 schema 顺序输出，summary 是第一个字段，因此可以边生成边展示。
 */
export function extractPartialSummary(partialJson: string): string | undefined {
  const start = partialJson.match(/"summary"\s*:\s*"/)
  if (!start || start.index === undefined) return undefined

  let raw = ''
  for (let i = start.index + start[0].length; i < partialJson.length; i += 1) {
    const char = partialJson[i]
    if (char === '\\') {
      if (i + 1 >= partialJson.length) break // 转义符还没生成完
      raw += char + partialJson[i + 1]
      i += 1
      continue
    }
    if (char === '"') break
    raw += char
  }

  // 去掉尚未生成完整的 \uXXXX
  raw = raw.replace(/\\u[0-9a-fA-F]{0,3}$/, '')
  try {
    return JSON.parse(`"${raw}"`) as string
  } catch {
    return undefined
  }
}
