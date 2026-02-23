# x402 Onboarding Guide

A step-by-step guide to integrating GoatX402 payments, from zero to a working test payment.

---

## Prerequisites

- Node.js ≥ 18
- pnpm (recommended) or npm
- [Foundry](https://getfoundry.sh/) (for contract deployment)
- A wallet with native tokens for gas on your target chain

---

## Step 1: Get Your Merchant Credentials

Contact the GoatX402 team to get:

| Credential | Description |
|---|---|
| `GOATX402_MERCHANT_ID` | Your unique merchant identifier |
| `GOATX402_API_KEY` | API key for HMAC authentication |
| `GOATX402_API_SECRET` | API secret (keep server-side only!) |
| `GOATX402_API_URL` | API endpoint (e.g., `https://x402-api-lx58aabp0r.testnet3.goat.network`) |

⚠️ **Never expose `API_KEY` or `API_SECRET` in frontend code.**

---

## Step 2: Clone and Install

```bash
git clone https://github.com/GOATNetwork/x402.git
cd x402

# Install demo dependencies
cd goatx402-demo
pnpm install

# Install server SDK (linked locally)
cd ../goatx402-sdk-server-ts
pnpm install

cd ../goatx402-demo
```

---

## Step 3: Configure Environment

Create `goatx402-demo/.env`:

```bash
GOATX402_MERCHANT_ID=your_merchant_id
GOATX402_API_URL=https://x402-api-lx58aabp0r.testnet3.goat.network
GOATX402_API_KEY=your_api_key
GOATX402_API_SECRET=your_api_secret

PORT=3001
```

---

## Step 4: Verify API Connection

Start the demo backend:

```bash
cd goatx402-demo
pnpm dev:server
```

Test the health endpoint:

```bash
curl http://localhost:3001/api/health
# Expected: {"status":"ok"}
```

Load your merchant config:

```bash
curl http://localhost:3001/api/config
```

This returns your supported chains and tokens. If `chains` is empty, your merchant needs chain/token configuration from the GoatX402 admin — see [Step 5](#step-5-merchant-configuration).

---

## Step 5: Merchant Configuration

Your merchant needs the following configured in the GoatX402 admin dashboard:

### 5a. Supported Chains & Tokens

Each chain you want to accept payments on needs:
- Chain ID (e.g., `48816` for GOAT Testnet3)
- Token contracts (USDT, USDC, etc.)

### 5b. Callback Contract (Required for DELEGATE flow)

If your merchant uses `ERC20_APPROVE_XFER` or `ERC20_3009` flow, you need a Callback Contract deployed on each chain.

**Deploy using Foundry:**

```bash
cd goatx402-contract

# Install dependencies
forge install

# Deploy (replace with your values)
forge script script/DeployMerchantCallback.s.sol:DeployMerchantCallback \
  --rpc-url <YOUR_RPC_URL> \
  --broadcast \
  --private-key <DEPLOYER_PRIVATE_KEY> \
  --gas-price <GAS_PRICE>
```

After deployment, send the **proxy contract address** to the GoatX402 team for configuration. They also need:
- `merchant_id`
- `chain_id`
- `eip712_name`
- `eip712_version`

### 5c. Fee Balance

Order creation deducts a fee from your merchant's fee balance. Ask the GoatX402 team to top up your fee balance. If it runs out, order creation will fail with `insufficient fee balance`.

---

## Step 6: Run the Demo

Start both frontend and backend:

```bash
cd goatx402-demo
pnpm dev
```

- **Frontend:** http://localhost:3000 (Vite + React)
- **Backend:** http://localhost:3001 (Express)

The frontend lets you connect MetaMask, select a chain/token, and make a test payment through the full flow.

---

## Step 7: Test Payment (API-only)

You can also test the full payment flow without a browser using `curl` and `cast` (Foundry):

### 7a. Create an Order

```bash
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": 48816,
    "tokenSymbol": "USDT",
    "tokenContract": "0xdce0af57e8f2ce957b3838cd2a2f3f3677965dd3",
    "fromAddress": "0xYOUR_WALLET_ADDRESS",
    "amountWei": "1000000"
  }'
```

**Success response** (HTTP 402 — this is correct per x402 protocol):

```json
{
  "orderId": "007a6713-...",
  "flow": "ERC20_APPROVE_XFER",
  "payToAddress": "0x8D5403Cd...",
  "expiresAt": 1771831788
}
```

### 7b. Send Payment On-Chain

Transfer the exact `amountWei` of the token to `payToAddress`:

```bash
cast send <TOKEN_CONTRACT> "transfer(address,uint256)" <PAY_TO_ADDRESS> <AMOUNT_WEI> \
  --private-key <YOUR_PRIVATE_KEY> \
  --rpc-url <RPC_URL> \
  --gas-limit 100000 \
  --priority-gas-price 130000 \
  --gas-price 1000000
```

### 7c. Poll Order Status

```bash
curl http://localhost:3001/api/orders/<ORDER_ID>
```

Status transitions:
1. `CHECKOUT_VERIFIED` — order created, waiting for payment
2. `PAYMENT_CONFIRMED` — payment detected and confirmed ✅
3. `INVOICED` — settlement complete
4. `EXPIRED` — order timed out
5. `CANCELLED` — order was cancelled

---

## Step 8: Go-Live Checklist

- [ ] `API_SECRET` is stored server-side only, never in frontend
- [ ] Fee balance is monitored and topped up regularly
- [ ] Stale `CHECKOUT_VERIFIED` orders are auto-cancelled
- [ ] Order status polling and proof retrieval are implemented
- [ ] Error handling covers all [common error codes](API.md)
- [ ] If using DELEGATE flow: calldata signature submission works

---

## Architecture Overview

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│  GoatX402     │
│  (SDK/React) │     │  (Express)   │     │  Core API     │
│              │     │              │     │              │
│ Wallet sign  │     │ HMAC auth    │     │ Order mgmt   │
│ Token xfer   │     │ Order create │     │ Payment watch│
│              │     │ Status poll  │     │ Proof issue  │
└──────────────┘     └──────────────┘     └──────────────┘
                                                │
                                          ┌─────┴─────┐
                                          │ Blockchain │
                                          │ (on-chain) │
                                          └───────────┘
```

---

## Supported Chains

| Chain | Chain ID | Status |
|---|---|---|
| GOAT Testnet3 | 48816 | ✅ Active |
| BSC Testnet | 97 | ✅ Active |
| Ethereum Sepolia | 11155111 | ✅ Active |
| Ethereum Mainnet | 1 | Coming soon |
| Polygon | 137 | Coming soon |
| Arbitrum | 42161 | Coming soon |
| BSC Mainnet | 56 | Coming soon |

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `Invalid API Key` (401) | Wrong credentials or expired key | Verify `API_KEY` and `API_SECRET` with GoatX402 team |
| `insufficient fee balance` (400) | Merchant fee balance is 0 | Ask GoatX402 team to top up |
| `merchant callback contract not configured` (400) | No callback contract for this chain | Deploy callback contract and register with GoatX402 |
| `token not supported on chain` (400) | Chain/token not configured | Ask GoatX402 team to add chain+token |
| Order stays `CHECKOUT_VERIFIED` | Payment not detected | Verify you sent to the correct `payToAddress` with exact `amountWei` |
| `HMAC signature invalid` (401) | Signature mismatch | Ensure SDK version matches API version; check timestamp sync |

---

## Further Reading

- [API Reference](API.md) — Full API docs with request/response schemas
- [Developer Guide](DEVELOPER_FAST.md) — Technical integration details
- [goatx402-sdk](goatx402-sdk/) — Frontend SDK (EVM)
- [goatx402-sdk-server-ts](goatx402-sdk-server-ts/) — Server SDK (TypeScript)
- [goatx402-sdk-server-go](goatx402-sdk-server-go/) — Server SDK (Go)
- [goatx402-contract](goatx402-contract/) — Callback contract (Foundry)
