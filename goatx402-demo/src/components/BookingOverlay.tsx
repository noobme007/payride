/**
 * BookingOverlay — full-screen success overlay sliding in from right
 */

import type { PaymentRecord } from '../types/travel'
import { config } from '../config'

interface Props {
  record: PaymentRecord | null
  order: { from: string; to: string; startDate: string; optionName?: string } | null
  onClose: () => void
}

function shortHash(h: string) {
  return h ? `${h.slice(0, 8)}…${h.slice(-6)}` : ''
}

export function BookingOverlay({ record, order, onClose }: Props) {
  if (!record) return null

  const explorerUrl = config.chains?.[48816]?.explorerUrl
  const txUrl = explorerUrl && record.txHash ? `${explorerUrl}/tx/${record.txHash}` : null
  const receiptId = `PAY-2026-${record.txHash?.slice(-4).toUpperCase() || '0000'}`

  return (
    <div className="overlay">
      <div className="overlay-card">
        <div className="overlay-icon">✅</div>
        <h2 className="overlay-title">BOOKING CONFIRMED</h2>
        <p className="overlay-receipt">Receipt #{receiptId}</p>

        <div className="overlay-divider" />

        <div className="overlay-detail-grid">
          {order && (
            <>
              <div className="overlay-row">
                <span className="overlay-label">Route</span>
                <span className="overlay-val">{order.from} → {order.to}</span>
              </div>
              {order.startDate && (
                <div className="overlay-row">
                  <span className="overlay-label">Date</span>
                  <span className="overlay-val">{order.startDate}</span>
                </div>
              )}
              {order.optionName && (
                <div className="overlay-row">
                  <span className="overlay-label">Option</span>
                  <span className="overlay-val">{order.optionName}</span>
                </div>
              )}
            </>
          )}
          <div className="overlay-row">
            <span className="overlay-label">Paid</span>
            <span className="overlay-val overlay-green">{record.amount} USDT</span>
          </div>
          <div className="overlay-row">
            <span className="overlay-label">Merchant</span>
            <span className="overlay-val">yaswanth_dev</span>
          </div>
          <div className="overlay-row">
            <span className="overlay-label">Chain</span>
            <span className="overlay-val">GOAT Testnet3 (48816)</span>
          </div>
          {record.txHash && (
            <div className="overlay-row">
              <span className="overlay-label">Tx</span>
              <span className="overlay-val mono">{shortHash(record.txHash)}</span>
            </div>
          )}
        </div>

        {txUrl && (
          <a href={txUrl} target="_blank" rel="noopener noreferrer" className="overlay-explorer-link">
            View on Explorer ↗
          </a>
        )}

        <div className="overlay-divider" />

        <div className="overlay-chain">
          <span className="overlay-chain-label">Agent Payment Chain</span>
          <div className="overlay-chain-row">
            <span className="chain-node">User</span>
            <span className="chain-arrow">→</span>
            <span className="chain-node">Route Scout</span>
            <span className="chain-arrow">→</span>
            <span className="chain-node chain-node-done">Payride ✅</span>
          </div>
        </div>

        <button className="btn-primary btn-full" onClick={onClose}>
          🔄 Book Another Trip
        </button>
      </div>
    </div>
  )
}
