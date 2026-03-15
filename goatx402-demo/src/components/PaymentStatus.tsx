/**
 * PaymentStatus — shows live order status with animated confirmation banner
 */

import type { Order, PaymentResult } from 'goatx402-sdk'
import { config } from '../config'

interface OrderProof {
  orderId: string
  merchantId: string
  dappOrderId: string
  chainId: number
  tokenContract: string
  tokenSymbol: string
  fromAddress: string
  amountWei: string
  status: string
  txHash?: string
  confirmedAt?: string
}

interface PaymentStatusProps {
  order: Order | null
  result: PaymentResult | null
  status: OrderProof | null
  error: string | null
  onReset: () => void
}

function badgeClass(s: string) {
  if (['PAYMENT_CONFIRMED', 'INVOICED'].includes(s)) return 'confirmed'
  if (['PAYMENT_FAILED', 'EXPIRED'].includes(s)) return 'failed'
  if (['PAYMENT_DETECTING', 'PAYMENT_CONFIRMING'].includes(s)) return 'pending'
  return 'default'
}

export function PaymentStatus({ order, result, status, error, onReset }: PaymentStatusProps) {
  if (!order && !result && !error) return null

  const explorerUrl = (chainId: number, tx: string) => {
    const chain = config.chains?.[chainId]
    return chain?.explorerUrl ? `${chain.explorerUrl}/tx/${tx}` : null
  }

  const isConfirmed = status && ['PAYMENT_CONFIRMED', 'INVOICED'].includes(status.status)

  return (
    <div className="payment-card">
      <div className="payment-header">
        <h2 className="payment-title">💳 Payment Status</h2>
        <button className="btn-new-payment" onClick={onReset}>New Payment</button>
      </div>

      {/* Confirmation banner */}
      {isConfirmed && (
        <div className="pay-confirm-banner">
          <div className="pay-confirm-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="pay-confirm-text">Booking Confirmed!</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
              Your payment was processed on-chain.
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !status && (
        <div className="error-banner">⚠️ {error}</div>
      )}

      {/* Order details */}
      {order && (
        <div>
          <div className="pay-grid">
            <div className="pay-field">
              <label>Order ID</label>
              <p style={{ fontSize: '0.72rem' }}>{order.orderId}</p>
            </div>
            <div className="pay-field">
              <label>Flow</label>
              <p>{order.flow}</p>
            </div>
            <div className="pay-field">
              <label>Amount</label>
              <p style={{ fontFamily: 'inherit', color: 'var(--emerald)', fontWeight: 600 }}>
                {(Number(order.amountWei) / 1e6).toFixed(2)} {order.tokenSymbol}
              </p>
            </div>
            <div className="pay-field">
              <label>Recipient</label>
              <p style={{ fontSize: '0.72rem' }}>{order.payToAddress.slice(0, 10)}…{order.payToAddress.slice(-8)}</p>
            </div>
          </div>

          {/* Tx result */}
          {result && (
            <div className={`pay-result ${result.success ? 'success' : 'fail'}`}>
              {result.success ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span>{result.success ? 'Transaction submitted' : 'Transaction failed'}</span>
              {result.txHash && (
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>
                  {explorerUrl(order.chainId, result.txHash) ? (
                    <a
                      href={explorerUrl(order.chainId, result.txHash)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tx-link"
                    >
                      View tx ↗
                    </a>
                  ) : (
                    <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--muted)' }}>
                      {result.txHash.slice(0, 12)}…
                    </span>
                  )}
                </span>
              )}
            </div>
          )}

          {/* Order status */}
          {status && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Status:</span>
                <span className={`pay-status-badge ${badgeClass(status.status)}`}>
                  {status.status.replace(/_/g, ' ')}
                </span>
              </div>
              {status.confirmedAt && (
                <p style={{ fontSize: '0.73rem', color: 'var(--muted)', marginTop: '0.4rem' }}>
                  Confirmed at: {new Date(status.confirmedAt).toLocaleString()}
                </p>
              )}
              {status.txHash && (
                <p style={{ fontSize: '0.73rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                  On-chain TX:{' '}
                  {explorerUrl(status.chainId, status.txHash) ? (
                    <a href={explorerUrl(status.chainId, status.txHash)!} target="_blank" rel="noopener noreferrer" className="tx-link">
                      {status.txHash.slice(0, 12)}… ↗
                    </a>
                  ) : (
                    <span style={{ fontFamily: 'monospace' }}>{status.txHash.slice(0, 12)}…</span>
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
