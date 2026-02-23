# x402 Onboarding Guide

A complete guide to integrating GoatX402 payments — covering **admin setup**, **developer integration**, and **end-to-end testing**.

---

## Table of Contents

1. [Roles Overview](#1-roles-overview)
2. [Admin: Merchant Setup](#2-admin-merchant-setup)
3. [Developer: Project Setup](#3-developer-project-setup)
4. [Developer: Callback Contract Deployment](#4-developer-callback-contract-deployment)
5. [Admin: Finalize Configuration](#5-admin-finalize-configuration)
6. [Developer: Run the Demo](#6-developer-run-the-demo)
7. [User: Making a Payment (Browser)](#7-user-making-a-payment-browser)
8. [Developer: API-Only Test Payment](#8-developer-api-only-test-payment)
9. [Full Test Log (Real Example)](#9-full-test-log-real-example)
10. [Go-Live Checklist](#10-go-live-checklist)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Roles Overview

| Role | Responsibilities |
|---|---|
| **GoatX402 Admin** | Create merchant, configure chains/tokens, set up fee balance, register callback contracts |
| **Developer (Merchant)** | Integrate SDK, deploy callback contract, run backend server, handle order lifecycle |
| **User (Payer)** | Connect wallet, approve payment, transfer tokens |

---

## 2. Admin: Merchant Setup

These steps are performed in the **GoatX402 Admin Dashboard**.

### 2a. Create Merchant

1. Go to the Admin Dashboard
2. Create a new merchant (e.g., `Openclaw_001`)
3. Generate API credentials:
   - **Merchant ID** — unique identifier
   - **API Key** — for HMAC authentication
   - **API Secret** — for signing requests (server-side only!)
4. Note the **API URL** (e.g., `https://x402-api-lx58aabp0r.testnet3.goat.network`)

### 2b. Configure Supported Chains & Tokens

For each chain the merchant accepts payments on:

1. Add the chain (e.g., GOAT Testnet3, chain ID `48816`)
2. Add supported tokens with their contract addresses:

| Chain | Chain ID | Token | Contract |
|---|---|---|---|
| GOAT Testnet3 | 48816 | USDT | `0xdce0af57e8f2ce957b3838cd2a2f3f3677965dd3` |
| GOAT Testnet3 | 48816 | USDC | `0x29d1ee93e9ecf6e50f309f498e40a6b42d352fa1` |
| BSC Testnet | 97 | USDT | `0x85181e18011d60ffebdf78fda202c2f5896eecae` |
| BSC Testnet | 97 | USDC | `0xa4b9550a5835ba669edd759cf82e6ca2d5e2c0a2` |

### 2c. Top Up Fee Balance

- Order creation deducts a fee from the merchant's fee balance
- Go to **Fees → Topup** and add funds for the merchant
- If balance runs out, order creation fails with `insufficient fee balance`
- **Recommendation:** Set up alerts to monitor fee balance

> ⚠️ This is a common blocker — if order creation returns `insufficient fee balance`, the admin needs to top up.

---

## 3. Developer: Project Setup

### 3a. Clone and Install

```bash
git clone https://github.com/GOATNetwork/x402.git
cd x402

# Install demo app dependencies
cd goatx402-demo
pnpm install

# Install server SDK (linked locally)
cd ../goatx402-sdk-server-ts
pnpm install

cd ../goatx402-demo
```

### 3b. Configure Environment

Create `goatx402-demo/.env` with the credentials from the admin:

```bash
GOATX402_MERCHANT_ID=your_merchant_id
GOATX402_API_URL=https://x402-api-lx58aabp0r.testnet3.goat.network
GOATX402_API_KEY=your_api_key
GOATX402_API_SECRET=your_api_secret

PORT=3001
```

> ⚠️ **Never commit `.env` to version control.** It's already in `.gitignore`.

### 3c. Verify API Connection

```bash
# Start the backend
pnpm dev:server

# In another terminal:
curl http://localhost:3001/api/health
# → {"status":"ok"}

# Check merchant config
curl http://localhost:3001/api/config
```

If `chains` is empty in the config response, the admin hasn't configured chains/tokens yet — go back to [Step 2b](#2b-configure-supported-chains--tokens).

---

## 4. Developer: Callback Contract Deployment

If your merchant uses the **DELEGATE flow** (`ERC20_APPROVE_XFER` or `ERC20_3009`), you need a callback contract on each chain.

### 4a. Install Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 4b. Deploy the Contract

```bash
cd goatx402-contract

# Install Solidity dependencies
forge install

# Deploy (Upgradeable Proxy pattern)
forge script script/DeployMerchantCallback.s.sol:DeployMerchantCallback \
  --rpc-url <RPC_URL> \
  --broadcast \
  --private-key <DEPLOYER_PRIVATE_KEY> \
  --gas-price <GAS_PRICE>
```

> **GOAT Testnet3 notes:**
> - RPC: `https://rpc.testnet3.goat.network`
> - Minimum gas price tip: `130000` wei
> - You need native tokens (BTC) for gas — use the [faucet](https://bridge.testnet3.goat.network/faucet)

### 4c. Note the Proxy Address

After deployment, note the **Proxy contract address** from the deployment output. Example:
```
== Return ==
proxy: address 0x3D62128a3b1601cbc015E8a98Eda9BA051319ed4
```

---

## 5. Admin: Finalize Configuration

After the developer deploys the callback contract:

### 5a. Register Callback Contract

In the Admin Dashboard, configure the callback contract for the merchant:
- **Merchant ID:** `Openclaw_001`
- **Chain ID:** `48816`
- **Callback Contract Address:** `0x3D62128a...` (the proxy address from Step 4)
- **EIP-712 Name:** (as configured in the contract)
- **EIP-712 Version:** (as configured in the contract)

### 5b. Add Authorized Caller

Add the GoatX402 authorized caller (`x402d`) to the callback contract's allowlist.

### 5c. Verify Everything

At this point, the merchant should have:
- [x] API credentials generated
- [x] Chains and tokens configured
- [x] Fee balance topped up
- [x] Callback contract registered (if using DELEGATE flow)

---

## 6. Developer: Run the Demo

```bash
cd goatx402-demo
pnpm dev
```

This starts:
- **Frontend (Vite + React):** http://localhost:3000
- **Backend (Express):** http://localhost:3001

---

## 7. User: Making a Payment (Browser)

1. Open http://localhost:3000 in a browser with MetaMask
2. Click **Connect MetaMask**
3. Switch to the correct network (e.g., GOAT Testnet3)
4. Select a token (e.g., USDT) and enter an amount
5. Click **Pay**
6. If the flow requires a calldata signature, MetaMask will prompt for an EIP-712 signature first
7. MetaMask will prompt for the token transfer to the `payToAddress`
8. Wait for the payment to be confirmed

**User prerequisites:**
- MetaMask or compatible EVM wallet
- The target network added to MetaMask (GOAT Testnet3: chain ID `48816`, RPC `https://rpc.testnet3.goat.network`)
- Sufficient token balance (e.g., USDT)
- Small amount of native tokens for gas

**Getting test tokens (GOAT Testnet3):**
- Native BTC for gas: [Faucet](https://bridge.testnet3.goat.network/faucet)
- Test USDT/USDC: Ask the GoatX402 team, or use a faucet contract if available

---

## 8. Developer: API-Only Test Payment

For headless testing without a browser/wallet, you can use `curl` + Foundry's `cast`:

### 8a. Create an Order

```bash
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": 48816,
    "tokenSymbol": "USDT",
    "tokenContract": "0xdce0af57e8f2ce957b3838cd2a2f3f3677965dd3",
    "fromAddress": "0xYOUR_WALLET",
    "amountWei": "1000000"
  }'
```

Response (HTTP 402 = **success** in x402 protocol):
```json
{
  "orderId": "007a6713-...",
  "flow": "ERC20_APPROVE_XFER",
  "payToAddress": "0x8D5403Cd...",
  "expiresAt": 1771831788
}
```

### 8b. Send Payment On-Chain

```bash
cast send <TOKEN_CONTRACT> \
  "transfer(address,uint256)" <PAY_TO_ADDRESS> <AMOUNT_WEI> \
  --private-key <YOUR_KEY> \
  --rpc-url https://rpc.testnet3.goat.network \
  --gas-limit 100000 \
  --priority-gas-price 130000 \
  --gas-price 1000000
```

### 8c. Poll Order Status

```bash
curl http://localhost:3001/api/orders/<ORDER_ID>
```

Status transitions:
```
CHECKOUT_VERIFIED → PAYMENT_CONFIRMED → INVOICED
                  → EXPIRED (timeout)
                  → CANCELLED (manual)
```

---

## 9. Full Test Log (Real Example)

Below is a complete, real test payment performed on **2026-02-23** on GOAT Testnet3.

### Environment

| Item | Value |
|---|---|
| Merchant | `Openclaw_001` |
| Chain | GOAT Testnet3 (`48816`) |
| Token | USDT (`0xdce0af57e8f2ce957b3838cd2a2f3f3677965dd3`) |
| Test Wallet | `0x2612567DFf7B6e03340d153F83a7Ca899c0b6299` |
| Callback Contract | `0x3D62128a3b1601cbc015E8a98Eda9BA051319ed4` |
| API URL | `https://x402-api-lx58aabp0r.testnet3.goat.network` |

### Step 1 — Verify Wallet Balance

```
Native (BTC): 0.0000385 (enough for gas)
USDT balance:  10.000000 (claimed from faucet)
```

### Step 2 — Health Check

```bash
$ curl http://localhost:3001/api/health
{"status":"ok"}
```

### Step 3 — Load Merchant Config

```bash
$ curl http://localhost:3001/api/config
{
  "merchantId": "Openclaw_001",
  "merchantName": "Openclaw_001",
  "chains": [
    { "chainId": 97, "name": "BSC Testnet", "tokens": ["USDC", "USDT"] },
    { "chainId": 48816, "name": "Goat Testnet", "tokens": ["USDC", "USDT"] },
    { "chainId": 11155111, "name": "Sepolia", "tokens": ["USDC", "USDT"] }
  ]
}
```

### Step 4 — Create Order (1 USDT)

```bash
$ curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": 48816,
    "tokenSymbol": "USDT",
    "tokenContract": "0xdce0af57e8f2ce957b3838cd2a2f3f3677965dd3",
    "fromAddress": "0x2612567DFf7B6e03340d153F83a7Ca899c0b6299",
    "amountWei": "1000000"
  }'

{
  "orderId": "007a6713-d1f0-45b2-be6c-e1e45ee81564",
  "flow": "ERC20_APPROVE_XFER",
  "payToAddress": "0x8D5403Cd1deD2982c758594BEcb4571A5B864057",
  "expiresAt": 1771831788
}
```

### Step 5 — Send USDT to TSS Wallet

```bash
$ cast send 0xdce0af57e8f2ce957b3838cd2a2f3f3677965dd3 \
  "transfer(address,uint256)" \
  0x8D5403Cd1deD2982c758594BEcb4571A5B864057 1000000 \
  --private-key $PK \
  --rpc-url https://rpc.testnet3.goat.network \
  --gas-limit 100000 \
  --priority-gas-price 130000 \
  --gas-price 1000000

status:          1 (success)
transactionHash: 0x96395b112eece299cc5d91e5d0f58a53180a5aac709e20fbd18de4f9905b911a
blockNumber:     11501261
gasUsed:         35024
```

🔗 [View on Explorer](https://explorer.testnet3.goat.network/tx/0x96395b112eece299cc5d91e5d0f58a53180a5aac709e20fbd18de4f9905b911a)

### Step 6 — Poll Order Status

```bash
# Poll 1 (immediately after tx):
$ curl http://localhost:3001/api/orders/007a6713-d1f0-45b2-be6c-e1e45ee81564
{"status": "CHECKOUT_VERIFIED", ...}

# Poll 2 (~5 seconds later):
$ curl http://localhost:3001/api/orders/007a6713-d1f0-45b2-be6c-e1e45ee81564
{
  "status": "PAYMENT_CONFIRMED",
  "txHash": "0x96395b112eece299cc5d91e5d0f58a53180a5aac709e20fbd18de4f9905b911a",
  "confirmedAt": "2026-02-23T07:10:05Z"
}
```

### Result: ✅ Payment Confirmed

The full flow — from order creation to on-chain payment to confirmation — completed in under 10 seconds.

---

## 10. Go-Live Checklist

### Admin
- [ ] Merchant created with API credentials
- [ ] All target chains and tokens configured
- [ ] Fee balance topped up and monitoring in place
- [ ] Callback contract registered (if DELEGATE flow)
- [ ] Authorized caller added to callback contract

### Developer
- [ ] `API_SECRET` stored server-side only, never in frontend
- [ ] `.env` is in `.gitignore`
- [ ] Order status polling implemented
- [ ] Proof retrieval implemented (for on-chain verification)
- [ ] Auto-cancel stale `CHECKOUT_VERIFIED` orders
- [ ] Error handling for all [common errors](API.md)
- [ ] If DELEGATE flow: calldata signature submission works

### User-Facing
- [ ] Target network details documented for users (chain ID, RPC URL)
- [ ] Faucet or test token instructions for testnet
- [ ] Clear error messages when wallet is on wrong network
- [ ] Payment timeout handling with user feedback

---

## 11. Troubleshooting

### Admin Issues

| Error | Cause | Fix |
|---|---|---|
| `merchant not found` | Merchant not created | Create merchant in Admin Dashboard |
| `insufficient fee balance` | Fee balance is 0 | Top up in Fees → Topup |
| `token not supported on chain` | Chain/token not configured | Add chain+token in Admin Dashboard |
| `callback contract not configured` | Missing callback contract | Register the deployed contract address |

### Developer Issues

| Error | Cause | Fix |
|---|---|---|
| `Invalid API Key` (401) | Wrong credentials | Verify `API_KEY` and `API_SECRET` match what admin generated |
| `HMAC signature invalid` (401) | Timestamp drift or SDK mismatch | Ensure server clock is synced (NTP); update SDK version |
| Server exits silently | Unhandled exception in Express | Add `process.on('uncaughtException')` handler; check logs |
| Order stays `CHECKOUT_VERIFIED` | Payment not detected | Verify exact `amountWei` sent to correct `payToAddress` |
| `gas required exceeds allowance` | Insufficient native balance for gas | Get native tokens from faucet |
| `gas tip cap below minimum` | Gas price too low | Set `--priority-gas-price 130000` (GOAT Testnet3 minimum) |

### User Issues

| Issue | Fix |
|---|---|
| MetaMask shows wrong network | Add GOAT Testnet3: chain `48816`, RPC `https://rpc.testnet3.goat.network` |
| "Insufficient funds" | Get test tokens from faucet or GoatX402 team |
| Transaction pending forever | Increase gas price; check network status |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        ADMIN DASHBOARD                          │
│  • Create merchant         • Configure chains/tokens            │
│  • Generate API keys       • Register callback contracts        │
│  • Top up fee balance      • Monitor orders                     │
└──────────────────────────────┬──────────────────────────────────┘
                               │ configures
                               ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│   Frontend   │────▶│   Backend    │────▶│   GoatX402 Core API  │
│  (User)      │     │  (Developer) │     │                      │
│              │     │              │     │  • Order management   │
│ • Connect    │     │ • HMAC auth  │     │  • Payment watching   │
│   wallet     │     │ • Create     │     │  • Fee deduction      │
│ • Sign EIP-  │     │   orders     │     │  • Proof issuance     │
│   712 data   │     │ • Poll       │     │  • Settlement         │
│ • Transfer   │     │   status     │     │                      │
│   tokens     │     │ • Get proof  │     │                      │
└──────────────┘     └──────────────┘     └──────────┬───────────┘
                                                     │ watches
                                                     ▼
                                          ┌──────────────────────┐
                                          │     Blockchain       │
                                          │                      │
                                          │ • Token transfers    │
                                          │ • Callback contracts │
                                          │ • TSS settlement     │
                                          └──────────────────────┘
```

---

## Further Reading

- [API Reference](API.md) — Full API docs with request/response schemas
- [Developer Guide](DEVELOPER_FAST.md) — Technical integration deep dive
- [goatx402-sdk](goatx402-sdk/) — Frontend SDK (EVM wallets)
- [goatx402-sdk-server-ts](goatx402-sdk-server-ts/) — Server SDK (TypeScript)
- [goatx402-sdk-server-go](goatx402-sdk-server-go/) — Server SDK (Go)
- [goatx402-contract](goatx402-contract/) — Callback contract (Foundry)
