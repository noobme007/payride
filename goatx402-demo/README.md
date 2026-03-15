# Payride — AI-Powered Local Travel Agent

**Payride** is a professional 2D dashboard travel agent built on [GOAT Testnet3](https://goat.network) using the x402 payment protocol. It enables autonomous AI-powered booking with on-chain USDT payments.

![Dashboard](./docs/screenshot.png)

## ✨ Features

### Two Modes
- **🏖️ Vacation Mode** — Hotel searches + trip packages (Beach, Hill Station, City Trip, Nature)
- **🚆 Transport Mode** — Trains, Buses, and mixed routes across Indian cities

### Smart Step Form
- Icebreaker chips — click once to advance (no typing needed)
- Custom flat 2D calendar — no native `<input type="date">` anywhere
- Smart city suggestions (e.g. Chennai → Tiruvallur, Avadi, Tambaram…)
- Session memory for frequently used origin cities

### AI Booking Agent
- **Search** — `POST /api/search` returns 3 ranked options
- **Book** — `POST /api/book` creates an x402 order; frontend pays via MetaMask
- **Agent** — Groq (`llama-3.3-70b-versatile`) picks the best option autonomously

### Payment
- Chain: **GOAT Testnet3 (48816)**
- Token: **USDT**
- Merchant: `yaswanth_dev`
- On-chain tx hashes shown in the bottom status bar + booking success overlay

## 🚀 Getting Started

### 1. Clone & install
```bash
git clone https://github.com/noobme007/payride.git
cd payride
pnpm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Edit `.env` with your credentials:
```
GOATX402_API_URL=https://x402-api-lx58aabp0r.testnet3.goat.network
GOATX402_MERCHANT_ID=yaswanth_dev
GOATX402_API_KEY=<your-api-key>
GOATX402_API_SECRET=<your-api-secret>
GROQ_API_KEY=<optional-for-agent>
```

### 3. Run
```bash
pnpm dev
```
Opens at **http://localhost:3009** (or nearest available port).

### 4. Connect wallet
- Install [MetaMask](https://metamask.io)
- Switch to **GOAT Testnet3** (Chain ID: 48816)
- Ensure you have USDT balance on the testnet

## 🏗️ Architecture

```
src/
├── App.tsx                    # Dashboard shell + all API/booking logic
├── components/
│   ├── CalendarPicker.tsx     # Custom flat 2D calendar (single/range)
│   ├── VacationForm.tsx       # 6-step vacation form
│   ├── TransportForm.tsx      # 6-step transport form
│   ├── ResultsPanel.tsx       # Empty / loading / results states
│   ├── BookingOverlay.tsx     # Full-screen booking success overlay
│   └── BottomBar.tsx          # Live agent status bar
├── hooks/
│   ├── useWallet.ts           # MetaMask connection
│   └── useGoatX402.ts         # x402 payment processing (unchanged)
└── server/
    └── index.ts               # Express: /api/search, /api/book, /api/agent
```

## 📸 UI Overview

| Area | Description |
|---|---|
| **Top Bar** | Logo · Vacation/Transport toggle · Wallet connect |
| **Left Panel (40%)** | Step-by-step form with chip navigation |
| **Right Panel (60%)** | SVG placeholder → Agent checklist → Result cards |
| **Bottom Bar** | Agent status · Payment count · Spent USDT · Last Tx |
| **Booking Overlay** | Receipt · Tx hash · Explorer link · Payment chain |

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Pure CSS (flat 2D design, Plus Jakarta Sans)
- **Payment**: [goatx402-sdk](https://www.npmjs.com/package/goatx402-sdk) + ethers.js
- **AI Agent**: Groq API (llama-3.3-70b-versatile)
- **Backend**: Express.js (bundled via Vite proxy)

## 📄 License

MIT
