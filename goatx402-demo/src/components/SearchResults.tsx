/**
 * SearchResults — ranked card list with animated entry + agent-pick button
 */

import type { TravelOption } from '../types/travel'

interface SearchResultsProps {
  options: TravelOption[]
  userRequest: string
  onBook: (option: TravelOption) => void
  onAgentBook: () => void
  booking: boolean
  agentPicking: boolean
  isConnected: boolean
}

export function SearchResults({
  options,
  onBook,
  onAgentBook,
  booking,
  agentPicking,
  isConnected,
}: SearchResultsProps) {
  if (options.length === 0) return null

  return (
    <div className="results-card" style={{ animation: 'fadeSlideUp 0.4s ease both' }}>
      <div className="results-header">
        <h2 className="results-title">✦ Results ({options.length})</h2>
        <button
          className="agent-pick-btn"
          onClick={onAgentBook}
          disabled={!isConnected || booking || agentPicking}
        >
          {agentPicking ? '⏳ Agent choosing…' : '🤖 Let agent pick best'}
        </button>
      </div>

      <div>
        {options.map((opt, rank) => (
          <div
            key={opt.id}
            className="result-item"
            style={{ animationDelay: `${rank * 0.07}s` }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="result-rank">#{rank + 1}</span>
              <h3 className="result-name">{opt.name}</h3>
              <p className="result-details">{opt.details}</p>
              <p style={{ marginTop: '0.3rem' }}>
                <span className="result-price">${opt.price}</span>
                <span className="result-rating">★ {opt.rating}</span>
              </p>
            </div>
            <button
              className="btn-book"
              onClick={() => onBook(opt)}
              disabled={!isConnected || booking}
            >
              Book
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
