# ZMK Trendyol Platform 🚀

AI-powered Trendyol marketplace management platform with real-time analytics, competitor intelligence, and autonomous pricing.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   ZMK Platform                   │
├─────────────┬───────────────┬───────────────────┤
│  Dashboard  │     API       │    Extension      │
│  Next.js 14 │  NestJS 10    │  Chrome MV3       │
│  Port 3000  │  Port 4000    │  Webpack 5        │
├─────────────┴───────────────┴───────────────────┤
│  PostgreSQL (Prisma)  │  Redis (BullMQ)         │
└───────────────────────┴─────────────────────────┘
```

## Features

- 📊 **KPI Dashboard** — Revenue, profit, margins, order heatmaps
- 🔍 **Competitor Intelligence** — Price tracking, buybox monitoring, stock probes
- ⚡ **God Mode** — OOS sniping, arbitrage scanning, cartel detection
- 🤖 **AI Assistant** — Chat-based store management with OpenAI/Anthropic/Gemini
- 🎯 **Ad Autopilot** — Automated campaign optimization and bid management
- 📈 **Analytics Engine** — Profitability P&L, restocking predictions, trend analysis
- 🔑 **Keyword Research** — SEO scoring, rank tracking, competitor keyword analysis
- 🏪 **Multi-Marketplace** — Trendyol + Hepsiburada + N11 + Amazon TR
- 🧾 **e-Fatura** — Turkish e-invoice generation and tax estimation
- 🔒 **Enterprise Security** — AES-256-GCM encryption, JWT auth, audit logs

## Quick Start

```bash
# 1. Clone
git clone https://github.com/zumerkk/zmktrendyol.git
cd zmktrendyol

# 2. Install
npm install

# 3. Environment
cp .env.example .env
# Edit .env with your credentials

# 4. Database
docker compose up -d
cd apps/api && npx prisma db push && npx tsx prisma/seed.ts

# 5. Run
cd apps/api && npm run dev      # API on :4000
cd apps/dashboard && npm run dev # Dashboard on :3000
```

## API Endpoints

**178 endpoints** across 12 modules:

| Module | Endpoints | Description |
|--------|-----------|-------------|
| Auth | 4 | JWT login, register, store connections |
| Trendyol | 18 | Products, orders, finance, health sync |
| Analytics | 8 | KPI, daily/monthly, heatmap, top products |
| Competitors | 16 | Price tracking, buybox, stock probes |
| Ads | 10 | Campaign management, autopilot, ACOS |
| Intelligence | 30 | AI chat, predictions, war room, forecasts |
| God Mode | 5 | Arbitrage, cartel detection, OOS sniping |
| Keywords | 8 | Research, SEO score, rank tracking |
| Marketplace | 10 | Multi-platform dashboard, sync |
| Scraper | 8 | Market data collection, seller analysis |
| E-Fatura | 4 | Invoice generation, tax estimates |
| Automation | 3 | Rule-based pricing, stock alerts |

## Tech Stack

- **API**: NestJS 10, Prisma 5.22, PostgreSQL, Redis, BullMQ
- **Dashboard**: Next.js 14, React 18
- **Extension**: Chrome MV3, TypeScript, Webpack 5
- **AI**: OpenAI GPT-4, Anthropic Claude, Google Gemini, Groq
- **Security**: AES-256-GCM, bcrypt, JWT, Helmet

## Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/zumerkk/zmktrendyol)

Uses `render.yaml` for automatic setup with PostgreSQL database.

## License

Private — ZMK Agency © 2026
