/**
 * Payride — 2D Dashboard Travel Agent
 * Layout: TopBar / (LeftPanel + RightPanel) / BottomBar
 * All x402/booking/search logic kept identical.
 */

import { useState, useCallback, useEffect } from 'react'
import { useWallet } from './hooks/useWallet'
import { useGoatX402 } from './hooks/useGoatX402'
import { VacationForm } from './components/VacationForm'
import { TransportForm } from './components/TransportForm'
import { ResultsPanel } from './components/ResultsPanel'
import { BookingOverlay } from './components/BookingOverlay'
import { BottomBar } from './components/BottomBar'
import type { TravelOption, BookResponse, PaymentRecord } from './types/travel'
import type { TripType, TripMode } from './types/travel'

const GOAT_CHAIN_ID = 48816

/* ── Exported so form components can use it ─ */
export interface SearchParams {
  tripType:      TripType
  tripMode:      TripMode
  from:          string
  to:            string
  destination:   string
  startDate:     string
  endDate:       string
  budget:        string
  passengers?:   number
  travelClass?:  string
  hotelStars?:   string
  departureTime?: string
}

type AppMode = 'vacation' | 'transport'

function App() {
  const wallet    = useWallet()
  const goatx402  = useGoatX402(wallet.signer)

  const [isLaunched,  setIsLaunched]  = useState(false)
  const [mode, setMode] = useState<AppMode>('transport')

  // Search state
  const [options,      setOptions]      = useState<TravelOption[]>([])
  const [searching,    setSearching]    = useState(false)
  const [agentPicking, setAgentPicking] = useState(false)
  const [userRequest,  setUserRequest]  = useState('')
  const [lastParams,   setLastParams]   = useState<SearchParams | null>(null)
  const [searchError,  setSearchError]  = useState<string | null>(null)

  // Agent / payment state
  const [agentStatus,  setAgentStatus]  = useState('Idle')
  const [payments,     setPayments]     = useState<PaymentRecord[]>([])
  const [totalSpent,   setTotalSpent]   = useState('0')
  const [pendingPayment, setPendingPayment] = useState<{
    optionId: string; amount: string
    optionName?: string
  } | null>(null)

  // Ensure correct chain
  useEffect(() => {
    if (wallet.isConnected && wallet.chainId !== GOAT_CHAIN_ID) {
      wallet.switchChain(GOAT_CHAIN_ID)
    }
  }, [wallet.isConnected, wallet.chainId])

  /* ── Search ───────────────────────────────────────────────── */
  const search = useCallback(async (params: SearchParams) => {
    if (!wallet.isConnected) return
    setLastParams(params)
    setOptions([])
    setSearching(true)
    setSearchError(null)
    setAgentStatus('Searching…')
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `Search failed: ${res.status}`)
      }
      const data = await res.json()
      setOptions(data.options || [])
      setUserRequest(
        `${params.tripType} in ${params.destination}, ${params.startDate} to ${params.endDate}, budget $${params.budget}`
      )
      setAgentStatus('Idle')
    } catch (e) {
      setAgentStatus('Error')
      setSearchError(e instanceof Error ? e.message : 'Search failed')
      console.error(e)
    } finally {
      setSearching(false)
    }
  }, [wallet.isConnected])

  /* ── Book ─────────────────────────────────────────────────── */
  const bookOption = useCallback(async (option: TravelOption) => {
    if (!wallet.isConnected || !wallet.address) return
    setAgentStatus('Booking…')
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionId:    option.id,
          tripType:    option.tripType,
          fromAddress: wallet.address,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `Book failed: ${res.status}`)
      }
      const data: BookResponse = await res.json()
      setPendingPayment({ optionId: option.id, amount: data.totalUsdt, optionName: option.name })
      const result = await goatx402.payWithOrder(data.order)
      setAgentStatus('Idle')
      if (!result?.success) setPendingPayment(null)
    } catch (e) {
      setAgentStatus('Error')
      setPendingPayment(null)
      console.error(e)
    }
  }, [wallet.isConnected, wallet.address, goatx402])

  /* ── Confirm payment → record ─────────────────────────────── */
  useEffect(() => {
    if (
      goatx402.orderStatus &&
      ['PAYMENT_CONFIRMED', 'INVOICED'].includes(goatx402.orderStatus.status) &&
      goatx402.paymentResult?.success &&
      goatx402.order &&
      pendingPayment
    ) {
      const txHash = goatx402.orderStatus.txHash || goatx402.paymentResult.txHash || ''
      setPayments(prev => {
        if (prev.some(p => p.txHash === txHash)) return prev
        return [...prev, {
          optionId:    pendingPayment.optionId,
          amount:      pendingPayment.amount,
          txHash,
          confirmedAt: new Date().toISOString(),
        }]
      })
      setTotalSpent(prev => (parseFloat(prev) + parseFloat(pendingPayment.amount)).toFixed(2))
      setPendingPayment(null)
    }
  }, [goatx402.orderStatus, goatx402.paymentResult?.success, goatx402.order, pendingPayment])

  /* ── Agent auto-book ──────────────────────────────────────── */
  const agentBook = useCallback(async () => {
    if (!wallet.isConnected || !wallet.address || options.length === 0) return
    setAgentPicking(true)
    setAgentStatus('Agent choosing…')
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userRequest, options }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `Agent failed: ${res.status}`)
      }
      const data  = await res.json()
      const sel = data.selectedOption as TravelOption
      setAgentPicking(false)
      await bookOption(sel)
    } catch (e) {
      setAgentPicking(false)
      setAgentStatus('Error')
      console.error(e)
    }
  }, [wallet.isConnected, wallet.address, options, userRequest, bookOption])

  /* ── Reset after booking ──────────────────────────────────── */
  const handleReset = () => {
    goatx402.reset()
    setOptions([])
    setLastParams(null)
    setUserRequest('')
  }

  /* ── Final bits ───────────────────────────────────────────── */
  const lastPayment = payments[payments.length - 1] ?? null
  const showOverlay =
    goatx402.orderStatus &&
    ['PAYMENT_CONFIRMED', 'INVOICED'].includes(goatx402.orderStatus.status) &&
    goatx402.paymentResult?.success &&
    lastPayment

  const fmtAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

  if (!isLaunched) {
    return (
      <div className="landing-page">
        <div className="bg-animate" />
        
        <header style={{ position: 'absolute', top: 0, width: '100%', padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="topbar-logo" style={{ color: '#fff' }}>
             <span style={{ fontSize: '1.8rem', animation: 'float 3s ease-in-out infinite', display: 'inline-block' }}>✈️</span>
             <span>PAYRIDE</span>
          </div>
          <button className="btn-launch" style={{ padding: '0.6rem 1.5rem', fontSize: '0.9rem' }} onClick={() => setIsLaunched(true)}>
            Dashboard
          </button>
        </header>

        <div className="hero-tag animate-pop">✨ World's 1st Autonomous AI Agent</div>
        <h1 className="hero-title animate-slide-up">
          Travel Smarter.<br />Let AI Book it.
        </h1>
        <p className="hero-sub animate-slide-up" style={{ animationDelay: '0.1s' }}>
          The first travel agent that doesn't just search—it signs transactions, handles payments, and confirms bookings autonomously on the GOAT Network.
        </p>

        <div className="hero-btns animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <button className="btn-launch" onClick={() => setIsLaunched(true)}>
            Launch Payride App →
          </button>
        </div>

        <div className="feat-grid animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <div className="feat-card">
            <div className="feat-icon">🤖</div>
            <h3 className="feat-h">AI-Led Booking</h3>
            <p className="feat-p">Our agent analyzes thousands of routes, picks the best, and executes the swap & payment via x402.</p>
          </div>
          <div className="feat-card">
            <div className="feat-icon">🛡️</div>
            <h3 className="feat-h">Secure & On-Chain</h3>
            <p className="feat-p">Non-custodial. You sign the permission, the agent does the work. Powered by GOAT Testnet.</p>
          </div>
          <div className="feat-card">
            <div className="feat-icon">🚆</div>
            <h3 className="feat-h">Indian Local Data</h3>
            <p className="feat-p">Complete coverage of Indian Railways, local buses, and seasonal flight paths in one dashboard.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="bg-animate" style={{ opacity: 0.15 }} />
      {/* ── TOP BAR ─────────────────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-logo" onClick={() => setIsLaunched(false)} style={{ cursor: 'pointer' }}>
          <span style={{ fontSize: '1.8rem', animation: 'float 3s ease-in-out infinite', display: 'inline-block' }}>✈️</span>
          <span>PAYRIDE</span>
        </div>

        <div className="topbar-modes">
          <button
            className={`mode-btn ${mode === 'vacation' ? 'mode-btn-active vacation' : ''}`}
            onClick={() => { setMode('vacation'); setOptions([]) }}
          >
            🏖️ Vacation
          </button>
          <button
            className={`mode-btn ${mode === 'transport' ? 'mode-btn-active transport' : ''}`}
            onClick={() => { setMode('transport'); setOptions([]) }}
          >
            🚆 Transport
          </button>
        </div>

        <div className="topbar-wallet">
          {wallet.isConnected && wallet.address ? (
            <div className="wallet-pill connected animate-pop">
              <span className="wallet-dot" />
              {fmtAddr(wallet.address)}
              <button className="wallet-disc" onClick={wallet.disconnect}>×</button>
            </div>
          ) : (
            <button
              className="wallet-pill disconnected animate-pop"
              onClick={wallet.connect}
              disabled={wallet.loading}
            >
              {wallet.loading ? 'Connecting…' : '🦊 Connect Wallet'}
            </button>
          )}
          {wallet.chainId && wallet.chainId !== GOAT_CHAIN_ID && wallet.isConnected && (
            <span className="wrong-chain">Wrong network</span>
          )}
        </div>
      </header>

      {/* ── MAIN AREA ───────────────────────────────────────── */}
      <main className="main-area">
        {/* Left panel — form */}
        <aside className="left-panel">
          <div className="panel-title">
            {mode === 'vacation' ? '🏖️ Plan Your Vacation' : '🚆 Find Your Route'}
          </div>
          <div className="form-scroll">
            {mode === 'vacation' ? (
              <VacationForm
                onSearch={search}
                searching={searching}
                isConnected={wallet.isConnected}
              />
            ) : (
              <TransportForm
                onSearch={search}
                searching={searching}
                isConnected={wallet.isConnected}
              />
            )}
          </div>
        </aside>

        {/* Divider */}
        <div className="panel-divider" />

        {/* Right panel — results */}
        <section className="right-panel">
          <ResultsPanel
            options={options}
            searching={searching}
            agentPicking={agentPicking}
            booking={goatx402.loading}
            isConnected={wallet.isConnected}
            mode={mode}
            onBook={bookOption}
            onAgentBook={agentBook}
            error={searchError || goatx402.error}
          />
        </section>
      </main>

      {/* ── BOTTOM BAR ──────────────────────────────────────── */}
      <BottomBar
        agentStatus={agentStatus}
        payments={payments}
        totalSpent={totalSpent}
        isConnected={wallet.isConnected}
        chainId={wallet.chainId}
      />

      {/* ── BOOKING OVERLAY ─────────────────────────────────── */}
      {showOverlay && lastPayment && (
        <BookingOverlay
          record={lastPayment}
          order={lastParams ? {
            from:        lastParams.from,
            to:          lastParams.to,
            startDate:   lastParams.startDate,
            optionName:  pendingPayment?.optionName,
          } : null}
          onClose={handleReset}
        />
      )}
    </div>
  )
}

export default App
