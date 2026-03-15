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
        <div className="floating-icons">
          <span className="float-icon" style={{ top: '10%', left: '10%' }}>✈️</span>
          <span className="float-icon" style={{ top: '20%', right: '15%', animationDelay: '2s' }}>🚆</span>
          <span className="float-icon" style={{ bottom: '15%', left: '20%', animationDelay: '4s' }}>🏖️</span>
          <span className="float-icon" style={{ bottom: '10%', right: '25%', animationDelay: '1s' }}>🚕</span>
          <span className="float-icon" style={{ top: '50%', left: '5%', animationDelay: '3s' }}>🏨</span>
        </div>

        <div className="landing-card animate-pop">
          <div className="hero-tag">✨ AUTONOMOUS AGENT</div>
          <h1 className="hero-title">
            PAYRIDE
          </h1>
          <div className="hero-sub">
            The World's first Travel Agent that handles your <strong>Money, Signing, and Booking</strong> autonomously on GOAT Network.
          </div>

          <button className="btn-launch" onClick={() => setIsLaunched(true)}>
            ENTER DASHBOARD →
          </button>

          <div className="feat-grid">
            <div className="feat-card">
              <div className="feat-icon">🤖</div>
              <h3 className="feat-h">AI Book</h3>
              <p className="feat-p">Agent signs & pays for you via x402.</p>
            </div>
            <div className="feat-card">
              <div className="feat-icon">⚡</div>
              <h3 className="feat-h">Instant</h3>
              <p className="feat-p">From search to ticket in 2 minutes.</p>
            </div>
            <div className="feat-card">
              <div className="feat-icon">🚆</div>
              <h3 className="feat-h">Local</h3>
              <p className="feat-p">Indian Railways & Local Bus data included.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="bg-animate" style={{ opacity: 0.1 }} />
      {/* ── TOP BAR (Neobrutalist) ─────────────────────────── */}
      <header className="topbar">
        <div className="topbar-logo" onClick={() => setIsLaunched(false)} style={{ cursor: 'pointer' }}>
          PAYRIDE
        </div>

        <div className="topbar-modes">
          <button
            className={`mode-btn ${mode === 'vacation' ? 'mode-btn-active vacation' : ''}`}
            onClick={() => { setMode('vacation'); setOptions([]) }}
          >
            🏖️ VACATION
          </button>
          <button
            className={`mode-btn ${mode === 'transport' ? 'mode-btn-active transport' : ''}`}
            onClick={() => { setMode('transport'); setOptions([]) }}
          >
            🚆 TRANSPORT
          </button>
        </div>

        <div className="topbar-wallet">
          {!wallet.isConnected ? (
            <button className="wallet-pill disconnected" onClick={wallet.connect} disabled={wallet.loading}>
              {wallet.loading ? 'CONNECTING...' : 'CONNECT WALLET'}
            </button>
          ) : (
            <div className="wallet-pill connected">
              {fmtAddr(wallet.address || '')}
              <button onClick={wallet.disconnect} style={{marginLeft:'10px', background:'none', border:'none', cursor:'pointer', fontWeight:900, fontSize:'1.2rem'}}>×</button>
            </div>
          )}
        </div>
      </header>

      {/* ── MAIN AREA (3 Panel neobrutalist split) ─────────── */}
      <main className="main-area">
        {/* Panel 1: Form (Fixed Width) */}
        <aside className="left-panel">
          <div className="panel-title" style={{ background: '#0F172A', color: '#fff' }}>
            {mode === 'vacation' ? '🏝️ VACATION PLAN' : '🎫 BOOKING FORM'}
          </div>
          <div className="form-scroll">
            {mode === 'vacation' ? (
              <VacationForm onSearch={search} searching={searching} isConnected={wallet.isConnected} />
            ) : (
              <TransportForm onSearch={search} searching={searching} isConnected={wallet.isConnected} />
            )}
          </div>
        </aside>

        {/* Panel 2: Results (Flexible Center) */}
        <section className="center-panel">
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

        {/* Panel 3: Status & History (Fixed Width) */}
        <aside className="status-panel">
          <div className="panel-title" style={{ borderBottom: '4px solid #0F172A', marginBottom: '1.5rem', background: '#FFD93D' }}>
            🛰️ NETWORK
          </div>
          
          <div style={{ background: '#FFF', border: '4px solid var(--primary)', padding: '1.25rem', marginBottom: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#64748B', textTransform: 'uppercase' }}>Available Balance</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{wallet.balance ? parseFloat(wallet.balance).toFixed(4) : '0.000'} ETH</div>
          </div>

          <div style={{ flex: 1, background: '#FFF', border: '4px solid var(--primary)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)', overflowY: 'auto' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 900, marginBottom: '0.75rem', borderBottom: '3px solid #F0F2F5', paddingBottom: '0.5rem' }}>ACTIVITY LOG</div>
            {payments.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', marginTop: '3rem', fontWeight: 700 }}>No transactions yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {payments.map((p, idx) => (
                  <div key={idx} style={{ padding: '0.75rem', border: '2px solid #0F172A', background: '#F8FAFC' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.txHash}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#10B981' }}>SUCCESS</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>{p.amount} USDT</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* ── OVERLAY & FOOTER ────────────────────────────────── */}
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

      <BottomBar
        agentStatus={agentStatus}
        payments={payments}
        totalSpent={totalSpent}
        isConnected={wallet.isConnected}
        chainId={wallet.chainId}
      />
    </div>
  )
}

export default App
