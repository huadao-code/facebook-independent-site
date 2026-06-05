import './admin.css'

const DEFAULT_SITE = {
  brand: 'LuLu Funny Tech Toys',
  subtitle: 'OEM & ODM supported worldwide.',
  category: 'Games / toys',
  whatsappNumber: '13072219043',
  email: 'sales@example.com',
  logoText: 'LF',
  logoImage: '',
  coverImage:
    'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1600&q=82',
}

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

const FIELD_LABELS = {
  category: 'Category',
  model: 'Model',
  name: 'Product Name',
  image: 'Image URL / Path',
  package: 'Package',
  carton: 'Carton Qty',
  cartonSize: 'Carton Size',
  weight: 'G.W./N.W.',
  moq: 'MOQ',
  inquiry: 'WhatsApp Message',
}

const admin = document.querySelector('#admin')
let site = DEFAULT_SITE
let products = []
let selectedIndex = 0

init()

async function init() {
  site = await loadSiteConfig()
  products = await loadProducts()
  if (products.length === 0) products = [createProduct()]
  render()
}

async function loadProducts() {
  const savedProducts = loadSavedProducts()
  if (savedProducts.length > 0) return savedProducts

  const response = await fetch('/data/products.csv')
  const csv = await response.text()
  return parseCsv(csv)
}

function render() {
  const product = products[selectedIndex] ?? createProduct()

  admin.innerHTML = `
    <header class="admin-header">
      <div>
        <p>Static SKU Catalog</p>
        <h1>Site Admin</h1>
      </div>
      <div class="admin-actions">
        <a href="/" target="_blank" rel="noreferrer">Open Frontend</a>
        <button type="button" data-action="save">Save Preview</button>
        <button type="button" data-action="export">Export CSV</button>
      </div>
    </header>

    <main class="admin-layout">
      <aside class="sidebar">
        <section class="panel">
          <h2>Preview</h2>
          <button class="cover-picker" type="button" data-upload="coverImage">
            <img src="${escapeHtml(site.coverImage)}" alt="Cover preview" />
            <span>Choose</span>
          </button>
          <button class="logo-picker" type="button" data-upload="logoImage">
            ${site.logoImage ? `<img src="${escapeHtml(site.logoImage)}" alt="Logo preview" />` : `<strong>${escapeHtml(site.logoText)}</strong>`}
            <span>Choose</span>
          </button>
          <input hidden type="file" accept="image/*" data-file-input="coverImage" />
          <input hidden type="file" accept="image/*" data-file-input="logoImage" />
          <div class="preview-copy">
            <h3>${escapeHtml(site.brand)}</h3>
            <p>${escapeHtml(site.subtitle)}</p>
            <p>${escapeHtml(site.category)}</p>
          </div>
        </section>

        <section class="panel">
          <div class="section-bar">
            <h2>SKU List</h2>
            <button type="button" data-action="add">New SKU</button>
          </div>
          <div class="product-list">
            ${products.map(renderProductListItem).join('')}
          </div>
        </section>
      </aside>

      <section class="workspace">
        <section class="panel">
          <h2>Company Profile</h2>
          <div class="form-grid company-grid">
            ${renderInput('brand', 'Company Name', site.brand, 'site')}
            ${renderInput('subtitle', 'Subtitle', site.subtitle, 'site')}
            ${renderInput('category', 'Main Category', site.category, 'site')}
            ${renderInput('logoText', 'Logo Text', site.logoText, 'site')}
            ${renderInput('whatsappNumber', 'WhatsApp Number', site.whatsappNumber, 'site')}
            ${renderInput('email', 'Email', site.email, 'site')}
            ${renderInput('coverImage', 'Cover Image URL', site.coverImage, 'site', true)}
            ${renderInput('logoImage', 'Logo Image URL', site.logoImage, 'site', true)}
          </div>
        </section>

        <section class="panel editor-panel">
          <div class="section-bar">
            <div>
              <p class="panel-kicker">SKU Editor</p>
              <h2>${escapeHtml(product.model || 'New SKU')}</h2>
            </div>
            <button type="button" data-action="delete">Delete SKU</button>
          </div>
          <div class="editor-body">
            <button class="product-image-picker" type="button" data-product-upload>
              <img src="${escapeHtml(product.image || '')}" alt="Product preview" />
              <span>Choose Image</span>
            </button>
            <input hidden type="file" accept="image/*" data-product-file-input />
            <div class="form-grid product-grid-form">
              ${PRODUCT_FIELDS.map((field) =>
                renderInput(field, FIELD_LABELS[field], product[field] ?? '', 'product', field === 'inquiry'),
              ).join('')}
            </div>
          </div>
        </section>
      </section>
    </main>
  `

  bindEvents()
}

function renderProductListItem(product, index) {
  const active = index === selectedIndex ? ' active' : ''
  return `
    <button class="${active}" type="button" data-select="${index}">
      <img src="${escapeHtml(product.image || '')}" alt="" />
      <span>${escapeHtml(product.model || 'No model')}</span>
      <strong>${escapeHtml(product.name || 'Untitled product')}</strong>
    </button>
  `
}

function renderInput(name, label, value, scope, wide = false) {
  const isTextArea = name === 'inquiry'
  const className = wide || isTextArea ? ' class="wide-field"' : ''
  const control = isTextArea
    ? `<textarea data-scope="${scope}" data-field="${name}">${escapeHtml(value)}</textarea>`
    : `<input data-scope="${scope}" data-field="${name}" value="${escapeHtml(value)}" />`

  return `
    <label${className}>
      <span>${label}</span>
      ${control}
    </label>
  `
}

function bindEvents() {
  admin.querySelectorAll('[data-scope]').forEach((input) => {
    input.addEventListener('input', handleFieldInput)
  })

  admin.querySelectorAll('[data-select]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedIndex = Number(button.dataset.select)
      render()
    })
  })

  admin.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => handleAction(button.dataset.action))
  })

  admin.querySelectorAll('[data-focus]').forEach((button) => {
    button.addEventListener('click', () => {
      const selector =
        button.dataset.focus === 'image'
          ? '[data-scope="product"][data-field="image"]'
          : `[data-scope="site"][data-field="${button.dataset.focus}"]`
      admin.querySelector(selector)?.focus()
    })
  })

  admin.querySelectorAll('[data-upload]').forEach((button) => {
    button.addEventListener('click', () => {
      admin.querySelector(`[data-file-input="${button.dataset.upload}"]`)?.click()
    })
  })

  admin.querySelectorAll('[data-file-input]').forEach((input) => {
    input.addEventListener('change', handleSiteImageFile)
  })

  admin.querySelector('[data-product-upload]')?.addEventListener('click', () => {
    admin.querySelector('[data-product-file-input]')?.click()
  })

  admin.querySelector('[data-product-file-input]')?.addEventListener('change', handleProductImageFile)
}

function handleFieldInput(event) {
  const { scope, field } = event.target.dataset
  if (scope === 'site') {
    site = { ...site, [field]: event.target.value }
  } else {
    products[selectedIndex] = { ...products[selectedIndex], [field]: event.target.value }
  }
}

function handleAction(action) {
  if (action === 'save') {
    savePreview()
  } else if (action === 'export') {
    exportCsv()
  } else if (action === 'add') {
    products.push(createProduct())
    selectedIndex = products.length - 1
    render()
  } else if (action === 'delete') {
    products.splice(selectedIndex, 1)
    if (products.length === 0) products.push(createProduct())
    selectedIndex = Math.max(0, selectedIndex - 1)
    render()
  }
}

function savePreview() {
  try {
    if (products.some((product) => String(product.image || '').startsWith('data:image/'))) {
      alert('Save failed: product images must use paths like /products/m16.jpg or image URLs, not base64 data images.')
      return
    }

    localStorage.setItem('siteConfig', JSON.stringify(site))
    localStorage.setItem('skuProducts', JSON.stringify(products))
    alert('Saved. Refresh the frontend page to preview changes.')
  } catch (error) {
    alert(`Save failed: ${error.message}. Use image paths or URLs instead of large base64 images.`)
  }
}

async function handleSiteImageFile(event) {
  const file = event.target.files?.[0]
  const field = event.target.dataset.fileInput
  if (!file || !field) return

  try {
    const image = await resizeImageFile(file, field === 'coverImage')
    site = { ...site, [field]: image }
    render()
  } catch (error) {
    alert(`Image failed: ${error.message}`)
  } finally {
    event.target.value = ''
  }
}

async function handleProductImageFile(event) {
  const file = event.target.files?.[0]
  if (!file) return

  try {
    const image = await resizeImageFile(file, {
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 0.82,
    })
    products[selectedIndex] = { ...products[selectedIndex], image }
    render()
  } catch (error) {
    alert(`Image failed: ${error.message}`)
  } finally {
    event.target.value = ''
  }
}

function resizeImageFile(file, options) {
  const settings =
    typeof options === 'boolean'
      ? {
          maxWidth: options ? 1600 : 512,
          maxHeight: options ? 700 : 512,
          quality: options ? 0.78 : 0.86,
        }
      : options

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('error', () => reject(new Error('Cannot read this image.')))
    reader.addEventListener('load', () => {
      const image = new Image()
      image.addEventListener('error', () => reject(new Error('Cannot load this image.')))
      image.addEventListener('load', () => {
        const { maxWidth, maxHeight, quality } = settings
        const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))

        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      })
      image.src = reader.result
    })
    reader.readAsDataURL(file)
  })
}

async function exportCsv() {
  const saved = await saveToLocalProject()
  if (saved) return

  const { exportProducts, imageExports } = prepareProductsForExport(products)
  const csv = toCsv(exportProducts)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, 'products.csv')

  imageExports.forEach((imageExport) => {
    downloadBlob(dataUrlToBlob(imageExport.dataUrl), imageExport.filename)
  })

  products = exportProducts
  render()

  if (imageExports.length > 0) {
    alert(`Exported CSV and ${imageExports.length} image file(s). Put the downloaded image file(s) into public/products.`)
  }
}

async function saveToLocalProject() {
  try {
    const response = await fetch('http://127.0.0.1:8787/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site, products }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Local save failed.')

    localStorage.removeItem('siteConfig')
    localStorage.removeItem('skuProducts')
    alert(`Saved directly to project. Products: ${result.products}. Product images: ${result.productImages}. Site images: ${result.siteImages}. Refresh the frontend.`)
    return true
  } catch (error) {
    alert(`Local save server is not running. I will try browser download instead. Error: ${error.message}`)
    return false
  }
}

function prepareProductsForExport(items) {
  const usedNames = new Set()
  const imageExports = []
  const exportProducts = items.map((item, index) => {
    const image = String(item.image || '')
    if (!image.startsWith('data:image/')) return item

    const filename = uniqueFilename(productImageName(item, index), usedNames)
    imageExports.push({ filename, dataUrl: image })
    return { ...item, image: `/products/${filename}` }
  })

  return { exportProducts, imageExports }
}

function productImageName(product, index) {
  const base = slug(product.model || product.name || `product-${index + 1}`)
  return `${base}.jpg`
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

function slug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'product'
}

function dataUrlToBlob(dataUrl) {
  const [meta, data] = dataUrl.split(',')
  const mime = meta.match(/^data:([^;]+)/)?.[1] || 'image/jpeg'
  const bytes = atob(data)
  const array = new Uint8Array(bytes.length)

  for (let index = 0; index < bytes.length; index += 1) {
    array[index] = bytes.charCodeAt(index)
  }

  return new Blob([array], { type: mime })
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function createProduct() {
  return PRODUCT_FIELDS.reduce((product, field) => {
    product[field] = ''
    return product
  }, {})
}

async function loadSiteConfig() {
  const savedSite = loadSavedSiteConfig()
  if (savedSite) return savedSite

  try {
    const response = await fetch('/data/site.json')
    if (response.ok) return { ...DEFAULT_SITE, ...(await response.json()) }
  } catch {
    return DEFAULT_SITE
  }

  return DEFAULT_SITE
}

function loadSavedSiteConfig() {
  try {
    return { ...DEFAULT_SITE, ...JSON.parse(localStorage.getItem('siteConfig') ?? '{}') }
  } catch {
    return null
  }
}

function loadSavedProducts() {
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

function parseCsv(csv) {
  const rows = csv.trim().split(/\r?\n/)
  const headers = splitCsvLine(rows.shift() ?? '')
  return rows.map((row) => {
    const values = splitCsvLine(row)
    return headers.reduce((record, header, index) => {
      record[header] = values[index] ?? ''
      return record
    }, createProduct())
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

function toCsv(items) {
  const rows = items.map((item) => PRODUCT_FIELDS.map((field) => csvValue(item[field] ?? '')).join(','))
  return `${PRODUCT_FIELDS.join(',')}\r\n${rows.join('\r\n')}\r\n`
}

function csvValue(value) {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
