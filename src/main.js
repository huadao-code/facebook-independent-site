import './style.css'

const DEFAULT_TRUST_STATS = [
  { value: '4,860+', unit: 'sqm', label: 'Factory Area' },
  { value: '3+', unit: 'lines', label: 'Production Lines' },
  { value: '5,000+', unit: 'pcs/day', label: 'Custom Daily Capacity' },
  { value: '80+', unit: 'people', label: 'Employees' },
]

const DEFAULT_CERTIFICATES = [
  { label: 'ICTI CARE', image: '' },
  { label: 'BSCI', image: '' },
  { label: 'ISO 9001', image: '' },
  { label: 'CE-RED', image: '' },
  { label: 'CCC', image: '' },
  { label: 'RoHS', image: '' },
  { label: 'EN71', image: '' },
]

const DEFAULT_SITE = {
  brand: 'LuLu Funny Toys',
  pageTitle: '',
  subtitle: 'OEM & ODM supported worldwide.',
  category: 'Games / toys',
  whatsappNumber: '13072219043',
  email: 'sales@example.com',
  logoText: 'LF',
  logoImage: '',
  coverImage:
    'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1600&q=82',
  trustStats: DEFAULT_TRUST_STATS,
  certificates: DEFAULT_CERTIFICATES,
}

const app = document.querySelector('#app')
let site = DEFAULT_SITE
let products = []

init()

async function init() {
  site = await loadSiteConfig()
  applyPageMeta(site)
  applyFavicon(site.logoImage || '/favicon.svg')
  products = await loadProducts()
  document.addEventListener('click', handleInquiryTracking)
  render()
}

async function loadProducts() {
  const savedProducts = loadSavedProducts()
  if (savedProducts.length > 0) return savedProducts

  const response = await fetch('/data/products.csv')
  const csv = await response.text()
  return parseCsv(csv).map((product) => product)
}

function render() {
  app.innerHTML = `
    <main class="page-shell">
      ${renderCompanyHeader()}
      ${renderFactorySection()}
      ${renderCertificateSection()}
      ${renderCatalog()}
      ${renderFooter()}
    </main>
    ${renderFloatingWhatsApp()}
  `
}

function renderCompanyHeader() {
  return `
    <section class="company-header">
      <img class="cover-image" src="${site.coverImage}" alt="Factory production line" />
      <div class="profile-row">
        <div class="logo-card" aria-label="${site.brand} logo">
          ${site.logoImage ? `<img src="${site.logoImage}" alt="${site.brand} logo" />` : `<span>${site.logoText}</span>`}
        </div>
        <div class="company-copy">
          <h1>${site.brand}</h1>
          <p>${site.subtitle}</p>
          <p class="category-line">${site.category}</p>
        </div>
        <div class="profile-actions">
          <a class="primary-button" href="${whatsAppUrl('Hello, I would like to ask about your SKU catalog.')}">WhatsApp</a>
          <a class="secondary-button" href="mailto:${site.email}">Email</a>
        </div>
      </div>
    </section>
  `
}

function renderFactorySection() {
  return `
    <section class="factory-section">
      <div class="section-heading">
        <span>Factory at a Glance</span>
        <h2>Production scale for OEM and wholesale orders.</h2>
      </div>
      <div class="factory-grid">
        ${site.trustStats.map(
          (item) => `
            <div class="factory-stat">
              <strong>
                <span class="factory-stat-value">${item.value}</span>
                <span class="factory-stat-unit">${item.unit}</span>
              </strong>
              <span>${item.label}</span>
            </div>
          `,
        ).join('')}
      </div>
    </section>
  `
}

function renderCertificateSection() {
  return `
    <section class="certificate-section">
      <div class="section-heading">
        <span>Compliance & Certifications</span>
        <h2>Certificate logos can be placed here for quick buyer verification.</h2>
      </div>
      <div class="certificate-grid" aria-label="Certification logo placeholders">
        ${site.certificates.map(
        (certificate) => `
            <div class="certificate-slot">
              <div class="certificate-logo-space">
                ${certificate.image ? `<img src="${certificate.image}" alt="${certificate.label} certificate" />` : ''}
              </div>
              <span>${certificate.label}</span>
            </div>
        `,
      ).join('')}
      </div>
    </section>
  `
}

function renderCatalog() {
  return `
    <section class="catalog-section">
      <div class="catalog-title">
        <h2>SKU Catalog</h2>
        <p>Children electronic toys for B2B inquiry. Key packing data only.</p>
      </div>
      <div class="sku-grid">
        ${products.map(renderProductCard).join('')}
      </div>
    </section>
  `
}

function renderProductCard(product) {
  return `
    <article class="sku-card">
      <img src="${product.image}" alt="${product.name}" loading="lazy" />
      <div class="sku-body">
        <div class="sku-heading">
          <span>${product.category}</span>
          <strong>${product.model}</strong>
        </div>
        <h3>${product.name}</h3>
        <dl class="sku-meta">
          <div><dt>MOQ</dt><dd>${stripPcs(product.moq)} pcs</dd></div>
          <div><dt>Package</dt><dd>${product.package}</dd></div>
          <div><dt>Carton Qty</dt><dd>${stripPcs(product.carton)} pcs/carton</dd></div>
          <div><dt>Carton Size</dt><dd>${product.cartonSize}</dd></div>
          <div><dt>G.W./N.W.</dt><dd>${product.weight}</dd></div>
        </dl>
        <a class="inquiry-link" href="${whatsAppUrl(product.inquiry)}">WhatsApp Quote</a>
      </div>
    </article>
  `
}

function renderFooter() {
  return `
    <footer class="footer">
      <span>${site.brand}</span>
      <a href="mailto:${site.email}">${site.email}</a>
    </footer>
  `
}

function renderFloatingWhatsApp() {
  return `
    <a class="floating-whatsapp" href="${whatsAppUrl('Hello, I would like to ask about your products.')}">
      WhatsApp
    </a>
  `
}

function stripPcs(value) {
  return value.replace(/\s*pcs\s*$/i, '')
}

async function loadSiteConfig() {
  const savedSite = loadSavedSiteConfig()
  if (savedSite) return savedSite

  try {
    const response = await fetch('/data/site.json')
    if (response.ok) return normalizeSiteConfig(await response.json())
  } catch {
    return normalizeSiteConfig(DEFAULT_SITE)
  }

  return normalizeSiteConfig(DEFAULT_SITE)
}

function loadSavedSiteConfig() {
  if (!isLocalPreviewHost()) return null

  try {
    const raw = localStorage.getItem('siteConfig')
    return raw ? normalizeSiteConfig(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function normalizeSiteConfig(config) {
  const next = { ...DEFAULT_SITE, ...config }
  return {
    ...next,
    trustStats: normalizeList(next.trustStats, DEFAULT_TRUST_STATS),
    certificates: normalizeList(next.certificates, DEFAULT_CERTIFICATES),
  }
}

function normalizeList(items, fallback) {
  const source = Array.isArray(items) ? items : []
  return fallback.map((fallbackItem, index) => ({ ...fallbackItem, ...(source[index] ?? {}) }))
}

function loadSavedProducts() {
  if (!isLocalPreviewHost()) return []

  try {
    const raw = localStorage.getItem('skuProducts') ?? '[]'
    if (raw.length > 500000 || raw.includes('data:image/')) {
      localStorage.removeItem('skuProducts')
      return []
    }

    const saved = JSON.parse(raw)
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

function isLocalPreviewHost() {
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
}

function applyFavicon(href) {
  let icon = document.querySelector('link[rel="icon"]')
  if (!icon) {
    icon = document.createElement('link')
    icon.rel = 'icon'
    document.head.append(icon)
  }
  icon.href = href
}

function applyPageMeta(config) {
  const title = String(config.pageTitle || '').trim() || `${config.brand} | B2B SKU Catalog`
  const description = `${config.brand} B2B SKU catalog with OEM and ODM inquiry support through WhatsApp.`

  document.title = title
  setMetaContent('meta[name="description"]', description)
  setMetaContent('meta[property="og:title"]', title)
  setMetaContent('meta[property="og:description"]', description)
}

function setMetaContent(selector, content) {
  const meta = document.querySelector(selector)
  if (meta) meta.content = content
}

function handleInquiryTracking(event) {
  const link = event.target.closest('a[href^="https://wa.me/"]')
  if (!link) return

  if (typeof window.fbq === 'function') {
    window.fbq('trackCustom', 'WhatsAppInquiry', { source: window.location.pathname })
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', 'whatsapp_inquiry', { page_path: window.location.pathname })
  }
}

function whatsAppUrl(message) {
  return `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(message)}`
}

function parseCsv(csv) {
  const rows = csv.trim().split(/\r?\n/)
  const headers = splitCsvLine(rows.shift())
  return rows.map((row) => {
    const values = splitCsvLine(row)
    return headers.reduce((record, header, index) => {
      record[header] = values[index] ?? ''
      return record
    }, {})
  })
}

function splitCsvLine(line) {
  const values = []
  let value = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"' && next === '"') {
      value += '"'
      index += 1
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      values.push(value)
      value = ''
    } else {
      value += char
    }
  }

  values.push(value)
  return values
}
