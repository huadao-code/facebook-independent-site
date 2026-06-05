# LuLu Funny Tech Toys 独立站

Static product showcase site for Facebook ad traffic. The site is built with Vite, reads SKU content from `public/data/products.csv`, and sends purchase intent to WhatsApp instead of processing checkout.

中文管理说明书见：

```text
docs/独立站管理说明书.md
```

可视化后台：

```text
http://localhost:5173/admin.html
```

## Run locally

```bash
npm install
npm run dev
```

## Update brand and contact details

Edit the `SITE` object in `src/main.js`:

- `brand`
- `whatsappNumber`
- `email`
- `company`
- `market`

Use an international WhatsApp number without `+`, spaces, or dashes.

## Update products

Edit `public/data/products.csv`. Keep the same headers:

- `category`
- `model`
- `name`
- `image`
- `package`
- `carton`
- `cartonSize`
- `weight`
- `moq`
- `inquiry`

The SKU card is designed for B2B buying decisions: image, model, product name, MOQ, packaging, carton quantity, carton size, weight, and WhatsApp inquiry.

## Deployment recommendation

Recommended setup:

- Domain: `.com` from Cloudflare Registrar or Namecheap
- DNS: Cloudflare
- Hosting: Vercel or Netlify
- Email: Zoho Mail or Google Workspace
- Conversion channel: WhatsApp Business

Before launch, replace placeholder brand/contact data, connect the final domain, and add Meta Pixel or Google Analytics IDs.

WhatsApp clicks automatically call these events when the relevant tracking scripts are present:

- Meta Pixel: `WhatsAppInquiry`
- Google Analytics: `whatsapp_inquiry`
