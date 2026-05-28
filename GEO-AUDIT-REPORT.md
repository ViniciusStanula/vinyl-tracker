# GEO Audit Report: Garimpa Vinil

**Audit Date:** 2026-05-28
**URL:** https://www.garimpavinil.com.br/guias/como-cuidar-de-discos-de-vinil
**Business Type:** Hybrid Publisher + Amazon Affiliate (vinyl price tracker with editorial guides)
**Pages Analyzed:** 10 (homepage, target guide, /guias index, /sobre, robots.txt, sitemap index, /llms.txt, /sitemap/estatico.xml, target page HTML, homepage HTML)
**Language:** pt-BR

---

## Executive Summary

**Overall GEO Score: 52/100 (Poor)**

The target page has genuinely strong, Brazil-specific content (~4,000 words, accurate technical data, FAQ section, maintenance checklist) fully server-rendered by Next.js on Vercel with clean crawlability and solid security headers. However, a near-zero external brand footprint (no Wikipedia, Reddit, YouTube, or LinkedIn presence) creates a hard ceiling on AI citation — models cannot confidently attribute the brand without corroborating external signals. The three highest-leverage fixes are all technical and can be done in under a day: add FAQPage JSON-LD, fix the Article schema author from Organization to Person, and add an og:image. These alone would push the score into the 60s.

### Score Breakdown

| Category | Score | Weight | Weighted Score |
|---|---|---|---|
| AI Citability | 72/100 | 25% | 18.0 |
| Brand Authority | 18/100 | 20% | 3.6 |
| Content E-E-A-T | 56/100 | 20% | 11.2 |
| Technical GEO | 74/100 | 15% | 11.1 |
| Schema & Structured Data | 42/100 | 10% | 4.2 |
| Platform Optimization | 42/100 | 10% | 4.2 |
| **Overall GEO Score** | | | **52/100** |

---

## Critical Issues (Fix Immediately)

### 1. Brand Authority: Near-Zero External Entity Signals
**Affects:** Brand Authority score (18/100), ChatGPT Web Search, Perplexity AI, Google Gemini, Bing Copilot

AI models require external corroborating signals to cite a brand confidently. Garimpa Vinil has none:

| Platform | Status |
|---|---|
| Wikipedia (pt/en) | ❌ Not present |
| Wikidata | ❌ Not present |
| Reddit | ❌ No indexed threads |
| YouTube | ❌ No channel |
| LinkedIn | ❌ No company page |
| Google Knowledge Panel | ❌ Not present |
| Telegram | ✅ Present (t.me/garimpavinil) |
| Instagram | ⚠️ @garimpavinil exists but belongs to Barra Funda vinyl fair — creates brand confusion |

**Fix:** See Brand Authority section. Priority: Wikipedia stub + one Reddit post + LinkedIn page.

### 2. Article Schema: Author Set as Organization, Not Person
**Affects:** Schema score, Content E-E-A-T, Google AI Overviews, ChatGPT

The existing Article JSON-LD has `"author": {"@type": "Organization"}`. Google's Article rich result guidelines require a `Person` with `name` and `url`. This blocks E-E-A-T attribution entirely — AI systems cannot resolve author expertise from an Organization entity.

**Fix:** Replace with:
```json
"author": {
  "@type": "Person",
  "name": "[AUTHOR_NAME or 'Equipe Garimpa Vinil']",
  "url": "https://www.garimpavinil.com.br/sobre"
}
```

### 3. FAQPage Schema Missing Despite 7 FAQ Items On-Page
**Affects:** Schema score, Google AI Overviews, Perplexity, all platforms

The page has a fully developed FAQ section ("Perguntas Frequentes Sobre Cuidados Com Disco de Vinil") with 7 Q&A pairs. No FAQPage JSON-LD exists. This is the highest-ROI schema addition available — FAQ markup directly triggers Google AI Overview inclusions and Perplexity citations for "how to" queries.

**Fix:** Add the FAQPage JSON-LD block from the Schema Appendix.

### 4. og:image Completely Missing
**Affects:** Technical score, all social platforms, Article schema rich result eligibility

No `og:image` or `twitter:image` meta tag exists. Google's Article rich result requires an image. Social sharing produces no preview. AI platforms that use link unfurling (ChatGPT, Perplexity) show no visual context.

**Fix:** Add a 1200×630px featured image for the guide and declare:
```html
<meta property="og:image" content="https://www.garimpavinil.com.br/images/como-cuidar-discos-vinil-og.jpg" />
<meta name="twitter:image" content="https://www.garimpavinil.com.br/images/como-cuidar-discos-vinil-og.jpg" />
```
Also add `"image": {"@type": "ImageObject", "url": "...", "width": 1200, "height": 630}` to the Article schema.

---

## High Priority Issues (Fix Within 1 Week)

### 5. No Author Attribution on Guide Pages
No byline appears on the target page or any guide. Content E-E-A-T Authoritativeness: 9/25. A named author with a brief bio and credentials (even "vinyl collector since X" or "music journalist") would improve E-E-A-T signals across all AI platforms. Minimum fix: add a visible byline linking to `/sobre`.

### 6. llms.txt Does Not Reference /guias/ Editorial Section
The `/llms.txt` file is well-written and documents the MCP API endpoint thoroughly. It does not mention the editorial guides at `/guias/`. AI models reading llms.txt for site context have no path to the content section. Add a `## Guias Editoriais` section with guide URLs and one-line descriptions.

### 7. llms-full.txt Returns 404
`/llms-full.txt` does not exist. Perplexity and some Claude crawlers use this extended format for richer context ingestion. Create it with full article text of each guide, FAQ pairs, and key factual statements.

### 8. No External Citations in Content
Zero outbound links to authoritative sources despite specific factual claims (needle lifespan ranges, humidity specs, PVC chemistry). This undermines Trustworthiness and makes claims unverifiable by AI systems. Add at least 3 citations: an Ortofon/Audio-Technica stylus spec page, a vinyl preservation standard, and a Brazilian climate/humidity source.

### 9. Bing Webmaster Tools + IndexNow Not Implemented
The guide page does not appear in Bing search results, meaning it is invisible to ChatGPT Web Search and Bing Copilot regardless of content quality. Implement IndexNow (30-minute task) and verify site in Bing Webmaster Tools.

### 10. Organization sameAs Has Only Telegram
The existing Organization schema declares only one `sameAs`: `https://t.me/garimpavinil`. Telegram provides zero entity disambiguation value for AI knowledge graphs. Add every active platform profile to this array.

---

## Medium Priority Issues (Fix Within 1 Month)

### 11. Title Tag Too Long (93 chars, truncates at 60)
Current: `"Como Cuidar de Discos de Vinil: Guia Completo Para Sua Coleção Durar Décadas | Garimpa Vinil"` (93 chars)
Google truncates at ~60 chars, cutting the brand name entirely.
Suggested: `"Como Cuidar de Discos de Vinil: Guia Completo | Garimpa Vinil"` (62 chars)

### 12. Meta Description Too Long (216 chars, truncates at 160)
Current description is 216 characters; Google truncates to ~155. The closing CTA sentence is cut. Trim to 155 characters.

### 13. lastmod Missing from All Non-Homepage Sitemap Entries
The sitemap index returns URLs with no `<lastmod>` except the homepage. The guide published 2026-05-27 has no freshness signal for Googlebot or AI crawlers. Add `<lastmod>` to all guide entries.

### 14. Thin Topical Cluster (3 Guides Total)
A single guide cannot establish topical authority. Perplexity and Gemini reward topical depth demonstrated across multiple related URLs. The vinyl care guide is currently an orphan. Build a cluster: turntable setup, stylus selection, condition grading (VG/NM/EX), vinyl storage furniture guide.

### 15. No Images in Article Body
A 4,000-word guide on tactile care of physical objects has no images. This affects Experience signals, time-on-page, and shareability. Add: correct vs. incorrect storage photo, labeled stylus diagram, before/after cleaning example.

### 16. speakable Property Missing from Article Schema
No `speakable` specification on the Article schema. This is a direct AI readability signal for Google Assistant and audio-capable AI platforms. Add `"speakable": {"@type": "SpeakableSpecification", "cssSelector": ["h1", ".article-intro"]}` to the Article block.

### 17. Article Missing wordCount, articleSection, keywords
These properties improve AI topic classification and schema completeness. Add: `"wordCount": 4328`, `"articleSection": "Guias"`, `"keywords": "cuidar de discos de vinil, limpar disco de vinil, armazenar vinil..."`.

---

## Low Priority Issues (Optimize When Possible)

### 18. twitter:card Should Be summary_large_image
Currently set to `summary`. When og:image is added, change to `summary_large_image` for full-width preview cards.

### 19. Explicit meta robots Tag Missing
Page defaults to `index, follow` but lacks explicit `<meta name="robots" content="index, follow">`. Low risk but explicit is better.

### 20. Content-Signal Directives Not in robots.txt
IETF Content-Signals draft (`ai-train=yes, search=yes, ai-retrieval=yes`) is emerging best practice. Two lines in robots.txt, forward-looking signal.

### 21. font-display CSS Unconfirmed
Two WOFF2 fonts are preloaded but font-display behavior is unverified. If using `font-display: block` (default), FOIT degrades LCP. Verify CSS declares `font-display: swap` or `optional`.

### 22. WebSite Schema Missing SearchAction
The WebSite JSON-LD lacks a `potentialAction` SearchAction, blocking Sitelinks Search Box eligibility.

### 23. Privacy Policy Has No Contact Email or Legal Entity
No email address or legal entity name anywhere on the site. Google's Quality Rater Guidelines weight contact information heavily for Trustworthiness. Add `redacao@garimpavinil.com.br` or equivalent.

---

## Category Deep Dives

### AI Citability (72/100)

Strong. The page scores well due to specific numeric claims, structured sections, and direct Q&A format.

**Top Citation-Ready Passages:**
1. Needle lifespan table (84/100) — "Agulhas cônicas/safira: 150–300h; elípticas/diamante: 500–800h; Microline/Shibata: 1.000–2.000h" — directly answers a high-frequency AI query
2. Storage conditions (79/100) — "Temperatura ideal: 15-20°C; umidade relativa: 35-45%" — specific, self-contained, Brazil-contextualized
3. Groove handling rule (76/100) — "Segure o disco apenas pelas bordas... Óleos naturais dos dedos ficam permanentemente presos nas micro-ranhuras" — causal explanation, high self-containment

**Citability Weaknesses:**
- Introductory paragraphs: 28/100 — generic framing, no specific claims
- "Inherited Records" section: 32/100 — useful but vague, no measurable thresholds
- No author attribution block — reduces citation confidence for entire page

**Recommendation:** Rewrite at least 4 H2 headings as direct search query forms with a 50-word "answer target" paragraph immediately after. Example: change "Limpeza passo a passo" to "Como limpar discos de vinil passo a passo?" followed by a direct 50-word answer before the detailed content.

---

### Brand Authority (18/100)

Critical weakness. Primary limiter on overall GEO score.

**Platform Presence Map:**
| Platform | Status | Notes |
|---|---|---|
| Wikipedia | ❌ Absent | Single highest-priority action — anchors entity recognition across all AI platforms |
| Reddit | ❌ Absent | Even 2-3 indexed threads change Perplexity's citation behavior |
| YouTube | ❌ Absent | Strongest Google ecosystem entry point available |
| LinkedIn | ❌ Absent | Activates Bing/Microsoft entity graph |
| Google Knowledge Panel | ❌ Absent | Requires Wikipedia or strong schema signals |
| Telegram | ✅ Present | Distribution channel, not an authority signal |

**Additional Risk:** Instagram @garimpavinil belongs to a separate entity (Barra Funda vinyl fair). AI models may conflate the two.

**3-Step Brand Authority Plan:**
1. **Wikipedia stub (pt.wikipedia.org)** — Notability basis: 13,000+ catalog, MCP server endpoint (rare in this niche), unique Brazilian market position. A sourced stub simultaneously improves ChatGPT, Perplexity, Gemini, and Bing Copilot.
2. **Reddit post** — Post to r/vinyl or r/brasil. Even 2-3 indexed threads change Perplexity's citation behavior for Portuguese vinyl queries.
3. **LinkedIn company page** — 1-hour task. Activates Microsoft entity graph and adds a qualifying sameAs URL.

---

### Content E-E-A-T (56/100)

| Dimension | Score | Key Gap |
|---|---|---|
| Experience | 14/25 | No first-person narrative, no original data, no images |
| Expertise | 15/25 | Accurate specs, but no author credentials or methodology transparency |
| Authoritativeness | 9/25 | 3 guides total, zero external recognition, zero citations |
| Trustworthiness | 14/25 | Amazon disclosure ✅, but no contact email, no legal entity name |

**Content Quality Highlights:**
- ~4,000 words, comprehensive structure, 13 H2 sections
- Brazil-specific climate storage advice (unique vs. generic English guides translated to PT)
- Mold handling section shows practical specificity ("fungo vivo — fungo ativo")
- Maintenance checklist (daily/monthly/annual) is structured and actionable
- Audio diagnosis section distinguishing noise types goes beyond typical beginner guides

**AI Content Assessment:** Likely human-edited AI draft. Content is technically accurate and Brazil-specific, but no first-person narrative, no original photography, and a perfectly regularized structure suggest AI-drafted with editorial review. Not disqualifying but limits Experience signals.

**Biggest Content Gap:** The guide does not cover turntable setup and calibration (tracking force/VTF, anti-skate, VTA). Improper tonearm setup destroys records faster than any storage mistake — its absence is the most consequential gap for a "complete care guide."

---

### Technical GEO (74/100)

**Strengths:**
- Next.js App Router on Vercel, `X-Nextjs-Prerender: 1` — full SSR, all 149 `<p>` tags visible to AI crawlers in raw HTML
- Clean robots.txt, all crawlers allowed
- Security headers: HSTS (2yr + preload), CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy all present
- Mobile: Tailwind responsive, correct viewport tag including `viewport-fit=cover`
- URL structure: clean, descriptive, two-level hierarchy (`/guias/como-cuidar-de-discos-de-vinil`)
- Canonical: self-referencing, correct
- `<html lang="pt-BR">` present
- All schema blocks are server-rendered, not JS-injected

**Issues:**
| Issue | Severity | Fix |
|---|---|---|
| og:image missing | High | Add 1200×630 image |
| Title 93 chars (brand truncated) | Medium | Shorten to ~62 chars |
| Meta description 216 chars (truncated) | Medium | Trim to 155 chars |
| llms-full.txt returns 404 | High | Create file |
| No lastmod in sitemap for guide pages | Medium | Add to sitemap |
| No IndexNow implementation | High | 30-min setup |
| font-display unverified | Low | Check CSS |

---

### Schema & Structured Data (42/100)

**Schemas Present (all server-rendered JSON-LD ✅):**
| Schema | Status | Issues |
|---|---|---|
| Organization | Present | sameAs has only Telegram, missing logo, foundingDate |
| WebSite | Present | Missing SearchAction |
| Article | Present | Author is Org not Person, missing image, wordCount, speakable |
| BreadcrumbList | Present | Likely valid |

**Critical Missing Schemas:**
- **FAQPage** — 7 FAQ pairs on page, zero JSON-LD. Highest-impact missing schema.
- **Person (author)** — Article author is Organization. Blocks E-E-A-T.
- **HowTo** — Step-by-step content present, no markup (no Google rich result since Sep 2023, but AI semantic value remains)

---

### Platform Optimization (42/100)

| Platform | Score | Primary Gap |
|---|---|---|
| Google AI Overviews | 52/100 | Missing FAQPage schema, author credentials |
| Bing Copilot | 46/100 | Not in Bing index, no IndexNow, no LinkedIn |
| Perplexity AI | 41/100 | No Reddit/community citations, no external citations in content |
| Google Gemini | 38/100 | No YouTube, no Google ecosystem presence |
| ChatGPT Web Search | 33/100 | No Wikipedia, no Wikidata, no entity resolution path |

**Cross-Platform Quick Wins (single action → multiple platforms):**
1. FAQPage + Article (fixed) schema → Google AIO + Bing Copilot + Gemini
2. Wikipedia article → ChatGPT + Perplexity + Gemini + Bing all improved
3. Named author byline → Google AIO + ChatGPT + Perplexity
4. IndexNow + Bing Webmaster Tools → Bing Copilot + ChatGPT Web Search

---

## Quick Wins (Implement This Week)

1. **Add FAQPage JSON-LD** — Paste from Schema Appendix below into page `<head>`. Triggers Google FAQ rich results and AI Overview inclusions. ~2h implementation. Highest ROI action available.

2. **Fix Article schema author** — Change `"@type": "Organization"` to `"@type": "Person"` with name and URL. 15-min fix. Unlocks E-E-A-T attribution for all AI platforms.

3. **Add og:image + twitter:image** — Create 1200×630px featured image. Add meta tags + `image` property to Article schema. Enables Article rich results and AI platform link unfurling.

4. **Shorten title tag** — 93 → ~62 chars. Brand name "Garimpa Vinil" is currently truncated out of SERP snippets entirely.

5. **Extend llms.txt to reference /guias/** — Add a `## Guias Editoriais` section. AI agents reading llms.txt currently have no path to this editorial content.

6. **Create /llms-full.txt** — Include full article text, FAQ pairs as Q&A, key factual statements. Supports Perplexity's richer ingestion mode.

7. **Add lastmod to guide entries in sitemap** — Add `<lastmod>2026-05-27</lastmod>` to the guide URL in `/sitemap/estatico.xml`.

8. **Implement IndexNow + Bing Webmaster Tools** — 30-min task. Guide may not be in Bing index at all.

---

## 30-Day Action Plan

### Week 1: Schema + Technical Fixes
- [ ] Add FAQPage JSON-LD (7 Q&A pairs — ready-to-paste in appendix below)
- [ ] Fix Article schema: author → Person, add image, add wordCount/articleSection/keywords/speakable
- [ ] Expand Organization sameAs array with all active platform profiles
- [ ] Add og:image and twitter:image meta tags
- [ ] Create featured image (1200×630px) for the guide
- [ ] Shorten title tag to ~62 chars
- [ ] Trim meta description to 155 chars
- [ ] Add lastmod dates to all guide entries in sitemap
- [ ] Implement IndexNow + verify site in Bing Webmaster Tools

### Week 2: Content & Author Identity
- [ ] Add named author byline to all guide pages
- [ ] Create `/sobre` author profile with bio and credentials
- [ ] Add 3+ external citations inside the guide (Ortofon stylus specs, archival standard, Brazilian humidity data)
- [ ] Extend llms.txt to reference /guias/ editorial section
- [ ] Create /llms-full.txt with guide text + FAQ pairs + key facts
- [ ] Add contact email to privacy policy and about page

### Week 3: Brand Authority Building
- [ ] Create LinkedIn company page for Garimpa Vinil
- [ ] Post to r/vinyl or r/brasil about the service (genuine community contribution)
- [ ] Research and draft pt.wikipedia.org stub for "Garimpa Vinil"
- [ ] Add Content-Signal directives to robots.txt (`ai-train=yes, search=yes`)

### Week 4: Content Cluster Expansion
- [ ] Publish: "Como Montar e Calibrar um Toca-Discos para Iniciantes" (biggest content gap — VTF, anti-skate, VTA)
- [ ] Publish: "Guia de Condição de Discos de Vinil: VG, EX, NM, M Explicados" (sebo purchase guide)
- [ ] Add images to the vinyl care guide (storage photos, stylus diagram)
- [ ] Cross-link all three guides from each other and from the /guias/ index

---

## Schema Appendix: Ready-to-Implement JSON-LD

All blocks go in `<head>` inside `<script type="application/ld+json">` tags.

### FAQPage (ADD — highest priority)

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Posso limpar disco de vinil com álcool?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Álcool puro não. Álcool isopropílico em concentração baixa (5 a 10%) misturado com água destilada é usado em algumas soluções profissionais, mas o álcool puro resseca o PVC e quebra as arestas microscópicas do sulco, causando perda permanente de fidelidade. Em discos de laca ou acetato (gravações antigas e prensagens de teste), álcool de qualquer concentração está absolutamente proibido."
      }
    },
    {
      "@type": "Question",
      "name": "De quanto em quanto tempo devo limpar meus vinis?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Escovação seca com fibra de carbono é regra antes de toda audição. Limpeza profunda com água destilada e sabão neutro é necessária em três situações: quando você compra um disco (novo ou usado), depois de longos períodos com o disco parado, ou quando aparecer um chiado novo que a escova seca não resolve."
      }
    },
    {
      "@type": "Question",
      "name": "Disco de vinil estraga se ficar parado muito tempo?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Em boas condições de armazenamento (vertical, sem sol, sem umidade alta, sem variação de temperatura extrema), um disco de vinil é praticamente eterno. Existem discos de 70 anos que tocam como novos. Em más condições, o estrago pode acontecer em meses: empenamento, mofo, capa amarelada e ressecada."
      }
    },
    {
      "@type": "Question",
      "name": "Vinil novo precisa ser limpo antes de tocar?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Sim. Mesmo dentro do plástico lacrado, todo disco novo tem resíduo do processo de prensagem na superfície e atraiu estática durante o transporte. Uma escovada com fibra de carbono e, se possível, um pano de microfibra úmido com água destilada antes da primeira audição protegem sua agulha desde a primeira rotação."
      }
    },
    {
      "@type": "Question",
      "name": "Como saber se meu disco está empenado?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Coloque o disco sobre uma superfície bem plana e olhe de lado. Se as bordas levantam em algum ponto, está empenado. No toca-discos, o braço sobe e desce visivelmente durante a rotação em casos médios e severos. Empenamento leve geralmente toca normal sem problema audível."
      }
    },
    {
      "@type": "Question",
      "name": "Disco riscado tem conserto?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Depende do tipo de risco. Arranhão muito superficial às vezes melhora com limpeza profunda, porque a sensação de 'risco' pode ser sujeira impregnada. Já o arranhão que engata a unha de verdade é dano físico permanente no sulco, sem volta possível em casa."
      }
    },
    {
      "@type": "Question",
      "name": "O que fazer com disco herdado ou comprado em sebo?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Faça uma triagem visual: leve o disco até uma janela ou luminária forte e gire em ângulo oblíquo à luz. Isso revela arranhões, marcas e empenamentos invisíveis em luz frontal. Discos com estado visual razoável vão para limpeza profunda com água destilada e sabão neutro antes da primeira audição. Não descarte nada antes de tentar limpar."
      }
    }
  ]
}
```

### Article (REPLACE existing block)

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Como Cuidar de Discos de Vinil: Guia Completo Para Sua Coleção Durar Décadas",
  "description": "Guia completo sobre como cuidar de discos de vinil: limpeza, armazenamento no clima brasileiro, cuidados com a agulha, erros a evitar e checklist de manutenção.",
  "inLanguage": "pt-BR",
  "datePublished": "2026-05-27",
  "dateModified": "2026-05-27",
  "wordCount": 4328,
  "articleSection": "Guias",
  "keywords": "cuidar de discos de vinil, limpar disco de vinil, armazenar vinil, limpeza vinil, manutenção vinil",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://www.garimpavinil.com.br/guias/como-cuidar-de-discos-de-vinil"
  },
  "author": {
    "@type": "Person",
    "name": "[REPLACE: AUTHOR_NAME]",
    "url": "https://www.garimpavinil.com.br/sobre",
    "worksFor": {
      "@type": "Organization",
      "name": "Garimpa Vinil",
      "url": "https://www.garimpavinil.com.br"
    }
  },
  "publisher": {
    "@type": "Organization",
    "name": "Garimpa Vinil",
    "url": "https://www.garimpavinil.com.br",
    "logo": {
      "@type": "ImageObject",
      "url": "[REPLACE: logo URL]",
      "width": 600,
      "height": 60
    }
  },
  "image": {
    "@type": "ImageObject",
    "url": "[REPLACE: 1200x630 og image URL]",
    "width": 1200,
    "height": 630
  },
  "speakable": {
    "@type": "SpeakableSpecification",
    "cssSelector": ["h1", ".article-intro"]
  }
}
```

### Organization (REPLACE existing — expand sameAs)

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Garimpa Vinil",
  "url": "https://www.garimpavinil.com.br",
  "description": "Rastreador de preços de discos de vinil na Amazon Brasil. Monitora mais de 13.000 títulos com alertas de promoções e histórico de preços.",
  "logo": {
    "@type": "ImageObject",
    "url": "[REPLACE: logo URL]",
    "width": 600,
    "height": 60
  },
  "foundingDate": "[REPLACE: launch year]",
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer support",
    "url": "https://t.me/garimpavinil"
  },
  "sameAs": [
    "https://t.me/garimpavinil"
  ]
}
```
*Add Wikipedia, LinkedIn, YouTube, Instagram, GitHub URLs to the `sameAs` array as you create each profile.*

### HowTo — Cleaning Process (ADD — AI semantic value; no Google rich result since Sep 2023)

```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "Como Limpar Disco de Vinil Passo a Passo",
  "description": "Guia completo de limpeza de discos de vinil, do cuidado diário à limpeza profunda com água destilada.",
  "inLanguage": "pt-BR",
  "totalTime": "PT30M",
  "supply": [
    {"@type": "HowToSupply", "name": "Escova de fibra de carbono"},
    {"@type": "HowToSupply", "name": "Pano de microfibra"},
    {"@type": "HowToSupply", "name": "Água destilada"},
    {"@type": "HowToSupply", "name": "Sabão neutro"}
  ],
  "step": [
    {
      "@type": "HowToStep",
      "position": 1,
      "name": "Limpeza rápida antes de cada audição",
      "text": "Coloque o LP no prato, ligue a rotação, segure uma escova de fibra de carbono apoiada de leve na superfície e deixe o disco girar duas ou três voltas completas embaixo das cerdas."
    },
    {
      "@type": "HowToStep",
      "position": 2,
      "name": "Prepare a solução de limpeza profunda",
      "text": "Misture água destilada com uma única gota de sabão neutro em meio litro de água. Nunca use água da torneira — o cloro deixa resíduo nos sulcos."
    },
    {
      "@type": "HowToStep",
      "position": 3,
      "name": "Aplique a solução no disco",
      "text": "Aplique com pano de microfibra novo em movimentos circulares acompanhando o sulco, nunca atravessando de uma borda à outra. Proteja o selo central."
    },
    {
      "@type": "HowToStep",
      "position": 4,
      "name": "Seque o disco corretamente",
      "text": "Apoie o disco em pé num escorredor de louça, longe de sol direto, por 20 a 30 minutos. Só guarde quando estiver completamente seco."
    },
    {
      "@type": "HowToStep",
      "position": 5,
      "name": "Limpe o stylus",
      "text": "Use escova de stylus seca em movimento sempre de trás para frente, no mesmo sentido em que o disco gira. Nunca movimento lateral. Faça isso a cada 2 ou 3 audições."
    }
  ]
}
```

---

## Appendix: Pages Analyzed

| URL | Title | Key GEO Issues |
|---|---|---|
| / | Garimpa Vinil — Melhores ofertas em discos de vinil | No meta description confirmed, thin About |
| /guias/como-cuidar-de-discos-de-vinil | Como Cuidar de Discos de Vinil... | Missing FAQPage schema, wrong author type, no og:image, no byline |
| /guias | Guias de Vinil | No meta description, no schema |
| /sobre | Sobre — Garimpa Vinil | Thin content, no credentials, no contact email |
| /robots.txt | — | All crawlers allowed ✅ |
| /llms.txt | — | Exists ✅, missing /guias/ references |
| /llms-full.txt | — | 404 ❌ |
| /sitemap.xml | — | Index present ✅, 31 child sitemaps |
| /sitemap/estatico.xml | — | lastmod missing on all pages except homepage |
