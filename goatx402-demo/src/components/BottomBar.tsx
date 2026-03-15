/**
 * BottomBar — always-visible status bar at the bottom of the dashboard
 */

import type { PaymentRecord } from '../types/travel'
import { config } from '../config'

interface Props {
  agentStatus: string
  payments: PaymentRecord[]
  totalSpent: string
  isConnected: boolean
  chainId: number | null
}

export function BottomBar({ agentStatus, payments, totalSpent, isConnected, chainId }: Props) {
  const explorerUrl = config.chains?.[48816]?.explorerUrl
  const lastPay = payments[payments.length - 1]
  const isActive = agentStatus !== 'Idle' && agentStatus !== 'Error'
  const isError  = agentStatus === 'Error'

  return (
    <div className="bottom-bar">
      <div className={`bb-item ${isActive ? 'bb-active' : isError ? 'bb-error' : ''}`}>
        <span className={`bb-dot ${isActive ? 'bb-dot-active' : isError ? 'bb-dot-error' : ''}`} />
        🤖 Agent: {agentStatus}
      </div>

      <div className="bb-sep" />

      <div className="bb-item">
        💳 Payments: {payments.length}
      </div>

      <div className="bb-sep" />

      <div className="bb-item bb-green">
        💰 Spent: {totalSpent} USDT
      </div>

      <div className="bb-sep" />

      <div className="bb-item">
        🔗 Last Tx:{' '}
        {lastPay && explorerUrl ? (
          <a className="bb-link" href={`${explorerUrl}/tx/${lastPay.txHash}`} target="_blank" rel="noopener noreferrer">
            {lastPay.txHash.slice(0, 10)}… ↗
          </a>
        ) : (
          <span style={{ color: '#718096' }}>—</span>
        )}
      </div>

      <div className="bb-sep" />

      <div className="bb-item">
        <span className={`bb-dot ${isConnected && chainId === 48816 ? 'bb-dot-active' : 'bb-dot-error'}`} />
        GOAT Testnet3
      </div>
    </div>
  )
}
