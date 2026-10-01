#!/usr/bin/env node

import { mkdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const apiVersion = process.env.META_GRAPH_API_VERSION || 'v25.0'
const instagramUserId = process.env.INSTAGRAM_USER_ID
const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN
const outputPath = path.resolve(process.cwd(), process.argv[2] || 'data/marta-instagram-posts.json')
const apiRoot = `https://graph.facebook.com/${apiVersion}`

if (!instagramUserId || !accessToken) {
  console.error('Defina INSTAGRAM_USER_ID e INSTAGRAM_ACCESS_TOKEN no ambiente ou em .env.')
  process.exit(1)
}

if (!/^v\d+\.\d+$/.test(apiVersion)) {
  console.error('META_GRAPH_API_VERSION deve ter o formato v25.0.')
  process.exit(1)
}

async function graphGet(edge, fields) {
  const items = []
  let after

  do {
    const url = new URL(`${apiRoot}/${edge}`)
    url.searchParams.set('fields', fields)
    url.searchParams.set('limit', '100')
    url.searchParams.set('access_token', accessToken)
    if (after) url.searchParams.set('after', after)

    const response = await fetch(url, { headers: { Accept: 'application/json' } })
    const result = await response.json().catch(() => null)

    if (!response.ok || !result || !Array.isArray(result.data)) {
      const message = result?.error?.message || `A API Graph respondeu HTTP ${response.status}.`
      throw new Error(message)
    }

    items.push(...result.data)
    after = result.paging?.next ? result.paging?.cursors?.after : undefined
  } while (after)

  return items
}

async function main() {
  const media = await graphGet(
    `${encodeURIComponent(instagramUserId)}/media`,
    'id,caption,media_type,media_url,permalink,timestamp,thumbnail_url',
  )

  const posts = await Promise.all(media.map(async (post) => {
    const item = {
      id: post.id,
      caption: post.caption ?? '',
      media_type: post.media_type,
      media_url: post.media_url ?? post.thumbnail_url ?? null,
      permalink: post.permalink ?? null,
      timestamp: post.timestamp ?? null,
    }

    if (post.media_type === 'CAROUSEL_ALBUM') {
      item.children = await graphGet(
        `${encodeURIComponent(post.id)}/children`,
        'id,media_type,media_url,permalink,thumbnail_url',
      )
    }

    return item
  }))

  const output = {
    exported_at: new Date().toISOString(),
    instagram_user_id: instagramUserId,
    posts,
  }
  const directory = path.dirname(outputPath)
  const temporaryPath = `${outputPath}.tmp`

  await mkdir(directory, { recursive: true })
  await writeFile(temporaryPath, `${JSON.stringify(output, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  await rename(temporaryPath, outputPath)

  console.log(`Exportadas ${posts.length} publicações para ${path.relative(projectRoot, outputPath) || outputPath}`)
}

main().catch((error) => {
  console.error(`Falha ao exportar publicações: ${error.message}`)
  process.exitCode = 1
})