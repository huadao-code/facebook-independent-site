import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

const PORT = 8787
const PRODUCT_FIELDS = [
  'category',
  'model',
  'name',
  'image',
  'package',
  'carton',
  'cartonSize',
  'weight',
  'moq',
  'inquiry',
]

const root = process.cwd()
const dataDir = join(root, 'public', 'data')
const productsDir = join(root, 'public', 'products')
const siteDir = join(root, 'public', 'site')
const certificatesDir = join(siteDir, 'certificates')
const publishScript = join(root, 'tools', 'publish-online.ps1')
let publishInProgress = false
let publishJob = {
  status: 'idle',
  log: '',
  startedAt: null,
  finishedAt: null,
  seconds: 0,
  error: '',
}

createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }

  if (request.method === 'GET' && request.url === '/publish-status') {
    sendJson(response, 200, publishJobView())
    return
  }

  if (request.method !== 'POST' || !['/save', '/publish'].includes(request.url)) {
    sendJson(response, 404, { error: 'Not found' })
    return
  }

  if (request.url === '/publish' && publishInProgress) {
    sendJson(response, 409, { error: 'Publish is already running.' })
    return
  }

  try {
    const body = await readJson(request)
    const result = await saveSite(body)
    if (request.url === '/save') {
      sendJson(response, 200, result)
      return
    }

    publishInProgress = true
    startPublishJob()
    sendJson(response, 202, { ok: true, save: result, publish: publishJobView() })
  } catch (error) {
    sendJson(response, 500, { error: error.message })
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Local admin server running at http://127.0.0.1:${PORT}`)
})

async function saveSite(body) {
  const products = Array.isArray(body.products) ? body.products : []
  const site = body.site && typeof body.site === 'object' ? body.site : {}
  const imageWrites = []
  const siteWrites = []

  await mkdir(dataDir, { recursive: true })
  await mkdir(productsDir, { recursive: true })
  await mkdir(siteDir, { recursive: true })
  await mkdir(certificatesDir, { recursive: true })

  const normalizedProducts = products.map((product, index) => {
    const next = { ...product }
    if (String(next.image || '').startsWith('data:image/')) {
      const filename = `${slug(next.model || next.name || `product-${index + 1}`)}.jpg`
      imageWrites.push(writeDataUrl(join(productsDir, filename), next.image))
      next.image = `/products/${filename}`
    }
    return next
  })

  const siteConfig = { ...site }
  if (String(siteConfig.coverImage || '').startsWith('data:image/')) {
    siteWrites.push(writeDataUrl(join(siteDir, 'cover.jpg'), siteConfig.coverImage))
    siteConfig.coverImage = '/site/cover.jpg'
  }
  if (String(siteConfig.logoImage || '').startsWith('data:image/')) {
    siteWrites.push(writeDataUrl(join(siteDir, 'logo.jpg'), siteConfig.logoImage))
    siteConfig.logoImage = '/site/logo.jpg'
  }

  if (Array.isArray(siteConfig.certificates)) {
    const usedNames = new Set()
    siteConfig.certificates = siteConfig.certificates.map((certificate, index) => {
      const next = { ...certificate }
      if (String(next.image || '').startsWith('data:image/')) {
        const filename = uniqueFilename(`${slug(next.label || `certificate-${index + 1}`)}.jpg`, usedNames)
        siteWrites.push(writeDataUrl(join(certificatesDir, filename), next.image))
        next.image = `/site/certificates/${filename}`
      }
      return next
    })
  }

  await Promise.all([...imageWrites, ...siteWrites])
  await writeFile(join(dataDir, 'products.csv'), toCsv(normalizedProducts), 'utf8')
  await writeFile(join(dataDir, 'site.json'), JSON.stringify(siteConfig, null, 2), 'utf8')

  return {
    ok: true,
    products: normalizedProducts.length,
    productImages: imageWrites.length,
    siteImages: siteWrites.length,
  }
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      body += chunk
    })
    request.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'))
      } catch (error) {
        reject(error)
      }
    })
    request.on('error', reject)
  })
}

async function writeDataUrl(path, dataUrl) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/)
  if (!match) throw new Error(`Invalid image data for ${path}`)
  await writeFile(path, Buffer.from(match[2], 'base64'))
}

function startPublishJob() {
  publishJob = {
    status: 'running',
    log: '',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    seconds: 0,
    error: '',
  }

  const startedAt = Date.now()
  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', publishScript, '-OnlineUrl', 'https://www.lulufunnytoys.com'],
    { cwd: root, windowsHide: true },
  )
  const timeout = setTimeout(() => {
    appendPublishLog('Publish timed out after 10 minutes.')
    child.kill()
  }, 10 * 60 * 1000)

  child.stdout.on('data', (chunk) => {
    appendPublishLog(chunk.toString())
  })

  child.stderr.on('data', (chunk) => {
    appendPublishLog(chunk.toString())
  })

  child.on('error', (error) => {
    clearTimeout(timeout)
    publishInProgress = false
    publishJob.status = 'error'
    publishJob.error = error.message
    publishJob.finishedAt = new Date().toISOString()
    publishJob.seconds = Math.round((Date.now() - startedAt) / 1000)
    appendPublishLog(error.message)
  })

  child.on('close', (code) => {
    clearTimeout(timeout)
    publishInProgress = false
    publishJob.status = code === 0 ? 'success' : 'error'
    publishJob.error = code === 0 ? '' : `Publish failed with code ${code}.`
    publishJob.finishedAt = new Date().toISOString()
    publishJob.seconds = Math.round((Date.now() - startedAt) / 1000)
  })
}

function appendPublishLog(text) {
  publishJob.log = `${publishJob.log}${text}`.slice(-12000)
}

function publishJobView() {
  const seconds =
    publishJob.status === 'running' && publishJob.startedAt
      ? Math.round((Date.now() - Date.parse(publishJob.startedAt)) / 1000)
      : publishJob.seconds
  return { ...publishJob, seconds, inProgress: publishInProgress }
}

function toCsv(items) {
  const rows = items.map((item) => PRODUCT_FIELDS.map((field) => csvValue(item[field] ?? '')).join(','))
  return `${PRODUCT_FIELDS.join(',')}\r\n${rows.join('\r\n')}\r\n`
}

function csvValue(value) {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function slug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'product'
}

function uniqueFilename(filename, usedNames) {
  const extensionIndex = filename.lastIndexOf('.')
  const base = extensionIndex > -1 ? filename.slice(0, extensionIndex) : filename
  const extension = extensionIndex > -1 ? filename.slice(extensionIndex) : ''
  let next = filename
  let count = 2

  while (usedNames.has(next)) {
    next = `${base}-${count}${extension}`
    count += 1
  }

  usedNames.add(next)
  return next
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}
