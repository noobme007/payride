/**
 * ResultsPanel — right side panel showing default/loading/results states
 */

import type { TravelOption } from '../types/travel'

interface Props {
  options: TravelOption[]
  searching: boolean
  agentPicking: boolean
  booking: boolean
  isConnected: boolean
  mode: 'vacation' | 'transport'
  onBook: (opt: TravelOption) => void
  onAgentBook: () => void
  error: string | null
}

function PlaceholderIllustration({ mode }: { mode: 'vacation' | 'transport' }) {
  if (mode === 'transport') {
    return (
      <svg viewBox="0 0 260 160" width="260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', margin: '0 auto' }}>
        {/* Track */}
        <line x1="20" y1="130" x2="240" y2="130" stroke="#E2E8F0" strokeWidth="4" strokeLinecap="round"/>
        <line x1="30" y1="130" x2="40" y2="140" stroke="#E2E8F0" strokeWidth="3"/>
        <line x1="70" y1="130" x2="80" y2="140" stroke="#E2E8F0" strokeWidth="3"/>
        <line x1="110" y1="130" x2="120" y2="140" stroke="#E2E8F0" strokeWidth="3"/>
        <line x1="150" y1="130" x2="160" y2="140" stroke="#E2E8F0" strokeWidth="3"/>
        <line x1="190" y1="130" x2="200" y2="140" stroke="#E2E8F0" strokeWidth="3"/>
        {/* Train body */}
        <rect x="30" y="80" width="160" height="46" rx="6" fill="#1A1A2E" stroke="#1A1A2E" strokeWidth="2"/>
        <rect x="30" y="70" width="50" height="16" rx="4" fill="#1A1A2E"/>
        {/* Windows */}
        <rect x="45" y="89" width="24" height="20" rx="3" fill="#00B4D8"/>
        <rect x="80" y="89" width="24" height="20" rx="3" fill="#00B4D8"/>
        <rect x="115" y="89" width="24" height="20" rx="3" fill="#00B4D8"/>
        <rect x="150" y="89" width="24" height="20" rx="3" fill="#00B4D8"/>
        {/* Wheels */}
        <circle cx="65" cy="130" r="10" fill="#1A1A2E"/>
        <circle cx="65" cy="130" r="5" fill="#E2E8F0"/>
        <circle cx="155" cy="130" r="10" fill="#1A1A2E"/>
        <circle cx="155" cy="130" r="5" fill="#E2E8F0"/>
        {/* Steam */}
        <circle cx="30" cy="55" r="8" fill="#E2E8F0" opacity="0.6"/>
        <circle cx="20" cy="42" r="6" fill="#E2E8F0" opacity="0.4"/>
        <circle cx="14" cy="32" r="4" fill="#E2E8F0" opacity="0.25"/>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 260 160" width="260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', margin: '0 auto' }}>
      {/* Plane body */}
      <path d="M30 90 L190 70 L220 80 L190 90 Z" fill="#1A1A2E"/>
      <path d="M180 72 L200 55 L210 60 L190 80 Z" fill="#FF6B35"/>
      <path d="M160 88 L175 105 L185 100 L175 84 Z" fill="#FF6B35"/>
      {/* Windows */}
      <circle cx="145" cy="78" r="6" fill="#00B4D8"/>
      <circle cx="125" cy="79" r="6" fill="#00B4D8"/>
      <circle cx="105" cy="80" r="6" fill="#00B4D8"/>
      {/* Ground dashes */}
      <line x1="20" y1="130" x2="240" y2="130" stroke="#E2E8F0" strokeWidth="2" strokeDasharray="8 6"/>
      {/* Clouds */}
      <ellipse cx="50" cy="35" rx="22" ry="12" fill="#E2E8F0"/>
      <ellipse cx="68" cy="30" rx="16" ry="11" fill="#E2E8F0"/>
      <ellipse cx="200" cy="45" rx="18" ry="10" fill="#E2E8F0"/>
      <ellipse cx="215" cy="40" rx="12" ry="9" fill="#E2E8F0"/>
    </svg>
  )
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="star-rating">
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: i <= Math.round(rating) ? '#FF6B35' : '#E2E8F0' }}>★</span>
      ))}
      <span style={{ fontSize: '0.75rem', color: '#718096', marginLeft: '4px' }}>{rating}</span>
    </span>
  )
}

function ResultCard({ opt, rank, onBook, booking, isConnected }: {
  opt: TravelOption
  rank: number
  onBook: (o: TravelOption) => void
  booking: boolean
  isConnected: boolean
}) {
  const usdt = (opt.price * 0.011).toFixed(2)
  const isBest = rank === 0

  return (
    <div className={`result-card ${isBest ? 'result-card-best' : ''}`}>
      {isBest && <div className="best-badge">⚡ BEST</div>}
      <div className="result-card-top">
        <div>
          <span className="result-rank">#{rank + 1}</span>
          <h3 className="result-name">{opt.name}</h3>
          <p className="result-details">{opt.details}</p>
        </div>
        <StarRating rating={opt.rating} />
      </div>

      {/* Transport route line */}
      {(opt.tripType === 'train' || opt.tripType === 'flight') && (
        <div className="result-route-row">
          <span className="result-time">Now</span>
          <div className="result-line">
            <span className="result-dot" />
            <div className="result-track" />
            <span className="result-dot" />
          </div>
          <span className="result-time">Arr.</span>
        </div>
      )}

      <div className="result-card-bottom">
        <div>
          <span className="result-price">₹{opt.price.toLocaleString()}</span>
          <span className="result-usdt">{usdt} USDT</span>
        </div>
        <button
          className="btn-book-card"
          onClick={() => onBook(opt)}
          disabled={!isConnected || booking}
        >
          {booking ? '⏳' : 'Book →'}
        </button>
      </div>
    </div>
  )
}

export function ResultsPanel({
  options, searching, agentPicking, booking,
  isConnected, mode, onBook, onAgentBook, error
}: Props) {

  if (searching || agentPicking) {
    return (
      <div className="results-panel">
        <div className="agent-working">
          <div className="agent-working-title">🤖 Payride Agent Working…</div>
          <div className="agent-step done">✅ Request received</div>
          <div className="agent-step active">
            <span className="spinner-dot" /> Paying Route Scout…
          </div>
          <div className="agent-step pending">⌛ Analyzing best options…</div>
          <div className="agent-step pending">⌛ Checking availability…</div>
        </div>
      </div>
    )
  }

  if (options.length === 0) {
    return (
      <div className="results-panel results-empty">
        <PlaceholderIllustration mode={mode} />
        <h3 className="empty-title">Your results will appear here</h3>
        <p className="empty-sub">Fill in the details on the left to get started</p>
        {error && <div className="results-error">⚠️ {error}</div>}
      </div>
    )
  }

  return (
    <div className="results-panel results-filled">
      <div className="results-header">
        <h3 className="results-title">{options.length} Options Found</h3>
        <span className="results-badge">{mode === 'vacation' ? '🏖️ Vacation' : '🚆 Transport'}</span>
      </div>

      <div className="results-list">
        {options.map((opt, i) => (
          <ResultCard
            key={opt.id}
            opt={opt}
            rank={i}
            onBook={onBook}
            booking={booking}
            isConnected={isConnected}
          />
        ))}
      </div>

      {/* Agent auto-book */}
      <div className="agent-book-banner">
        <div>
          <p className="agent-book-title">🤖 Let Agent Pick &amp; Book Best</p>
          <p className="agent-book-sub">Agent will choose + pay autonomously via x402</p>
        </div>
        <button
          className="btn-agent"
          onClick={onAgentBook}
          disabled={!isConnected || booking || agentPicking}
        >
          ⚡ Agent Book Now
        </button>
      </div>
    </div>
  )
}
