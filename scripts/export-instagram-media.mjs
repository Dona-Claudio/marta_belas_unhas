#!/usr/bin/env node

import { mkdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const apiVersion = process.env.META_GRAPH_API_VERSION || 'v25.0'
const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN
const instagramUsername = process.env.INSTAGRAM_USERNAME?.replace(/^@/, '').toLowerCase()
const outputPath = path.resolve(process.cwd(), process.argv[2] || 'data/marta-instagram-posts.json')
const apiRoot = `https://graph.facebook.com/${apiVersion}`

if (!accessToken) {
  console.error('Defina INSTAGRAM_ACCESS_TOKEN no ambiente ou em .env.')
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
  const pages = await graphGet(
    'me/accounts',
    'id,name,instagram_business_account{id,username}',
  )
  const accounts = pages.flatMap((page) => {
    const account = page.instagram_business_account
    return account ? [{ id: account.id, username: account.username, pageName: page.name }] : []
  })
  const matchingAccounts = instagramUsername
    ? accounts.filter((account) => account.username?.toLowerCase() === instagramUsername)
    : accounts

  if (matchingAccounts.length !== 1) {
    const available = accounts.map((account) => `@${account.username}`).join(', ')
    if (matchingAccounts.length > 1 || (accounts.length > 1 && !instagramUsername)) {
      throw new Error(`O token acessa mais de uma conta profissional (${available}). Defina INSTAGRAM_USERNAME para escolher a correta.`)
    }
    if (instagramUsername && accounts.length > 0) {
      throw new Error(`A conta @${instagramUsername} não foi encontrada entre as contas acessíveis: ${available}.`)
    }
    throw new Error('Nenhuma conta profissional do Instagram foi encontrada nas Páginas acessíveis pelo token. Verifique a Página vinculada e as permissões.')
  }

  const instagramAccount = matchingAccounts[0]
  const media = await graphGet(
    `${encodeURIComponent(instagramAccount.id)}/media`,
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
    instagram_user_id: instagramAccount.id,
    instagram_username: instagramAccount.username,
    facebook_page_name: instagramAccount.pageName,
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