/**
 * GoatX402 Demo Backend Server
 *
 * This server handles GoatX402 API calls securely, keeping API credentials on the backend.
 * Payride: travel search, book (x402), and AI agent.
 */

import express from 'express'
import cors from 'cors'
import Groq from 'groq-sdk'
import { GoatX402Client } from 'goatx402-sdk-server'
import 'dotenv/config'

const app = express()
const port = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Create GoatX402 client
const goatx402Client = new GoatX402Client({
  baseUrl: process.env.GOATX402_API_URL || 'http://localhost:8286',
  apiKey: process.env.GOATX402_API_KEY || '',
  apiSecret: process.env.GOATX402_API_SECRET || '',
})

// Payride: GOAT Testnet3, USDT, merchant yaswanth_dev
const PAYRIDE_CHAIN_ID = 48816
const PAYRIDE_USDT = '0xdce0af57e8f2ce957b3838cd2a2f3f3677965dd3'
const PAYRIDE_MERCHANT_ID = process.env.GOATX402_MERCHANT_ID || 'yaswanth_dev'
const USDT_DECIMALS = 6

// Amounts in human-readable USDT: search 0.01, hotel 0.50, flight 1.00, train 0.50
function amountWei(amount: string): string {
  const [whole = '0', frac = ''] = amount.split('.')
  const fracPadded = frac.slice(0, USDT_DECIMALS).padEnd(USDT_DECIMALS, '0')
  return (BigInt(whole) * BigInt(10 ** USDT_DECIMALS) + BigInt(fracPadded)).toString()
}

// Merchant ID from environment (for existing /api/config and /api/orders)
const merchantId = process.env.GOATX402_MERCHANT_ID || 'yaswanth_dev'

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Get app config (supported chains and tokens from merchant)
app.get('/api/config', async (_req, res) => {
  try {
    const merchant = await goatx402Client.getMerchant(merchantId)

    // Group tokens by chain
    const chains: Record<
      number,
      {
        chainId: number
        name: string
        tokens: Array<{ symbol: string; contract: string }>
      }
    > = {}

    // Chain name mapping
    const chainNames: Record<number, string> = {
      97: 'BSC Testnet',
      56: 'BSC Mainnet',
      48816: 'Goat Testnet',
      1: 'Ethereum',
      137: 'Polygon',
    }

    for (const token of merchant.supportedTokens) {
      if (!chains[token.chainId]) {
        chains[token.chainId] = {
          chainId: token.chainId,
          name: chainNames[token.chainId] || `Chain ${token.chainId}`,
          tokens: [],
        }
      }
      chains[token.chainId].tokens.push({
        symbol: token.symbol,
        contract: token.tokenContract,
      })
    }

    res.json({
      merchantId: merchant.merchantId,
      merchantName: merchant.name,
      chains: Object.values(chains),
    })
  } catch (error) {
    console.error('Get config error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get config',
    })
  }
})

// ---------------------------------------------------------------------------
// Payride: Travel search (mock), book (x402), agent (Claude)
// ---------------------------------------------------------------------------

type TripType = 'hotel' | 'flight' | 'train'
type TripMode = 'one_way' | 'round_trip'

interface TravelSearchParams {
  from: string
  to: string
  destination: string
  startDate: string
  endDate: string
  budget: string
  tripType: TripType
  tripMode: TripMode
}

interface TravelOption {
  id: string
  name: string
  price: number
  rating: number
  tripType: TripType
  details: string
}

// POST /api/search — mock travel options ranked by price + rating
app.post('/api/search', (req, res) => {
  try {
    const { from, to, destination, startDate, endDate, budget, tripType, tripMode } =
      req.body as TravelSearchParams
    if (!startDate || !endDate || !budget || !tripType) {
      return res
        .status(400)
        .json({ error: 'Missing fields: startDate, endDate, budget, tripType' })
    }
    const budgetNum = parseFloat(budget) || 500
    const options: TravelOption[] = []

    const tripLabel =
      tripType === 'hotel'
        ? destination || to || from
        : `${from || 'Origin'} → ${to || 'Destination'}`

    if (tripType === 'train') {
      // Prefer train / mixed routes. Special case for Chennai → Tiruvallur.
      const isChennaiToTiruvallur =
        from.toLowerCase().includes('chennai') && to.toLowerCase().includes('tiruvallur')

      const basePrice = budgetNum * 0.4
      options.push(
        {
          id: `opt-train-direct-${Date.now()}`,
          name: isChennaiToTiruvallur ? 'Chennai Central → Tiruvallur (Direct MEMU)' : 'Direct Express Train',
          price: Math.round(basePrice * 100) / 100,
          rating: 4.6,
          tripType: 'train',
          details: `${tripLabel} • ${tripMode === 'round_trip' ? 'Round trip' : 'One-way'} • Fastest route`,
        },
        {
          id: `opt-train-mixed-${Date.now()}`,
          name: 'Metro + Suburban Train',
          price: Math.round((basePrice * 0.9) * 100) / 100,
          rating: 4.3,
          tripType: 'train',
          details: `${tripLabel} • Mixed metro + train • Fewest changes`,
        },
        {
          id: `opt-bus-${Date.now()}`,
          name: 'AC Government Bus',
          price: Math.round((basePrice * 0.7) * 100) / 100,
          rating: 4.0,
          tripType: 'train',
          details: `${tripLabel} • Bus fallback if trains unavailable`,
        }
      )
    } else if (tripType === 'flight') {
      const names = ['SkyFast Direct', 'BudgetAir Connect', 'Premium Airways']
      for (let i = 0; i < 3; i++) {
        const legMultiplier = tripMode === 'round_trip' ? 1.8 : 1
        const basePrice = budgetNum * (0.8 + Math.random() * 0.4) * legMultiplier
        const price = Math.round(basePrice * 100) / 100
        const rating = Math.round((4 + Math.random() * 1) * 10) / 10
        options.push({
          id: `opt-flight-${Date.now()}-${i}`,
          name: names[i],
          price,
          rating,
          tripType,
          details: `${tripLabel} • ${tripMode === 'round_trip' ? 'Round trip' : 'One-way'} • ${startDate} to ${endDate}`,
        })
      }
    } else {
      // Hotels – still 3, but nights-aware
      const nights =
        startDate && endDate
          ? Math.max(
              1,
              Math.round(
                (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
              )
            )
          : 1
      const names = ['Grand Plaza Hotel', 'Riverside Inn', 'City Center Suites']
      for (let i = 0; i < 3; i++) {
        const basePrice = budgetNum * (0.6 + Math.random() * 0.5)
        const price = Math.round((basePrice * nights) * 100) / 100
        const rating = Math.round((3.8 + Math.random() * 1.2) * 10) / 10
        options.push({
          id: `opt-hotel-${Date.now()}-${i}`,
          name: names[i],
          price,
          rating,
          tripType,
          details: `${destination || tripLabel} • ${nights} night(s) • ${startDate} to ${endDate}`,
        })
      }
    }

    // Rank by score: higher rating better, shorter/cheaper route better
    options.sort((a, b) => {
      const scoreA = a.rating * 25 - a.price / 15
      const scoreB = b.rating * 25 - b.price / 15
      return scoreB - scoreA
    })
    res.json({ options })
  } catch (error) {
    console.error('Search error:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Search failed' })
  }
})

// POST /api/book — create x402 order for selected option; frontend pays via useGoatX402
app.post('/api/book', async (req, res) => {
  try {
    const { optionId, tripType, fromAddress } = req.body
    if (!optionId || !tripType || !fromAddress) {
      return res.status(400).json({ error: 'Missing fields: optionId, tripType, fromAddress' })
    }
    const searchFee = '0.01'
    const bookingAmounts: Record<TripType, string> = {
      hotel: '0.50',
      flight: '1.00',
      train: '0.50',
    }
    const booking = bookingAmounts[tripType as TripType] || '0.50'
    const total = (parseFloat(searchFee) + parseFloat(booking)).toFixed(2)
    const amountWeiStr = amountWei(total)

    const order = await goatx402Client.createOrder({
      dappOrderId: `payride-${Date.now()}-${optionId}`,
      chainId: PAYRIDE_CHAIN_ID,
      tokenSymbol: 'USDT',
      tokenContract: PAYRIDE_USDT,
      fromAddress,
      amountWei: amountWeiStr,
    })

    // Normalize for frontend (Order type expects chainId, payToAddress, etc.)
    const orderForFrontend = {
      orderId: order.orderId,
      flow: order.flow,
      tokenSymbol: order.tokenSymbol,
      tokenContract: order.tokenContract,
      fromAddress,
      payToAddress: order.payToAddress,
      chainId: order.fromChainId || PAYRIDE_CHAIN_ID,
      amountWei: order.amountWei,
      expiresAt: order.expiresAt,
      calldataSignRequest: order.calldataSignRequest,
    }

    res.json({
      confirmation: `Booking ${optionId} (${tripType}) — ${total} USDT`,
      optionId,
      tripType,
      totalUsdt: total,
      order: orderForFrontend,
    })
  } catch (error: unknown) {
    console.error('Book error:', error)
    const errObj = error as { status?: number; responseBody?: unknown }
    const status = errObj.status || 500
    if (errObj.responseBody) console.error('Response body:', errObj.responseBody)
    res.status(status).json({
      error: error instanceof Error ? error.message : 'Failed to create booking order',
      details: errObj.responseBody,
    })
  }
})

// POST /api/agent — Groq picks best option from search results
app.post('/api/agent', async (req, res) => {
  try {
    const { userRequest, options } = req.body as {
      userRequest: string
      options: TravelOption[]
    }
    if (!userRequest || !options?.length) {
      return res.status(400).json({ error: 'Missing userRequest or options' })
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({ error: 'Agent unavailable: GROQ_API_KEY not set' })
    }

    const optionsText = options
      .map(
        (o, i) =>
          `[${i}] ${o.name} — $${o.price} — rating ${o.rating} — ${o.details} (id: ${o.id})`
      )
      .join('\n')

    const prompt = `You are a travel agent. The user said: "${userRequest}"

Available options (ranked):
${optionsText}

Reply with exactly one line: the index (0, 1, or 2) of the best option for the user. No other text.`

    // Lazily create Groq client only when agent is used
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
    })

    const text = (completion.choices[0]?.message?.content ?? '').trim()
    const match = text.match(/\b([012])\b/)
    const index = match ? parseInt(match[1], 10) : 0
    const selected = options[index] ?? options[0]

    res.json({
      selectedOption: selected,
      selectedIndex: index,
      agentReason: text,
    })
  } catch (error) {
    console.error('Agent error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Agent failed',
    })
  }
})

// Create order
app.post('/api/orders', async (req, res) => {
  try {
    const { chainId, tokenSymbol, tokenContract, fromAddress, amountWei, callbackCalldata } =
      req.body

    if (!chainId || !tokenSymbol || !tokenContract || !fromAddress || !amountWei) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const order = await goatx402Client.createOrder({
      dappOrderId: `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      chainId,
      tokenSymbol,
      tokenContract,
      fromAddress,
      amountWei,
      callbackCalldata,
    })

    // Return order to frontend (includes payment instructions)
    res.json({
      orderId: order.orderId,
      flow: order.flow,
      payToAddress: order.payToAddress,
      expiresAt: order.expiresAt,
      calldataSignRequest: order.calldataSignRequest,
      // Include original params for frontend display
      chainId,
      tokenSymbol,
      tokenContract,
      fromAddress,
      amountWei,
    })
  } catch (error: unknown) {
    console.error('Create order error:', error)
    const errObj = error as { status?: number; responseBody?: unknown }
    const status = errObj.status || 500
    // Include responseBody for debugging
    if (errObj.responseBody) {
      console.error('Response body:', errObj.responseBody)
    }
    res.status(status).json({
      error: error instanceof Error ? error.message : 'Failed to create order',
      details: errObj.responseBody,
    })
  }
})

// Get order status
app.get('/api/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params
    const order = await goatx402Client.getOrderStatus(orderId)
    res.json(order)
  } catch (error: unknown) {
    console.error('Get order error:', error)
    const status = (error as { status?: number }).status || 500
    res.status(status).json({
      error: error instanceof Error ? error.message : 'Failed to get order',
    })
  }
})

// Submit calldata signature
app.post('/api/orders/:orderId/signature', async (req, res) => {
  try {
    const { orderId } = req.params
    const { signature } = req.body

    if (!signature) {
      return res.status(400).json({ error: 'Missing signature' })
    }

    await goatx402Client.submitCalldataSignature(orderId, signature)
    res.json({ success: true })
  } catch (error: unknown) {
    console.error('Submit signature error:', error)
    const status = (error as { status?: number }).status || 500
    res.status(status).json({
      error: error instanceof Error ? error.message : 'Failed to submit signature',
    })
  }
})

// Get merchant info
app.get('/api/merchants/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params
    const merchant = await goatx402Client.getMerchant(merchantId)
    res.json(merchant)
  } catch (error: unknown) {
    console.error('Get merchant error:', error)
    const status = (error as { status?: number }).status || 500
    res.status(status).json({
      error: error instanceof Error ? error.message : 'Failed to get merchant',
    })
  }
})

// Start server
app.listen(port, () => {
  console.log(`Demo server running at http://localhost:${port}`)

  // Warn if credentials are missing
  if (!process.env.GOATX402_API_KEY || !process.env.GOATX402_API_SECRET) {
    console.warn('Warning: GOATX402_API_KEY and/or GOATX402_API_SECRET not set')
    console.warn('Please create a .env file with your credentials')
  }
})
