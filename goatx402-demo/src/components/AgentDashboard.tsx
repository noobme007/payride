/**
 * AgentDashboard — dark panel with pulsing status, payment list, tx links
 */

import type { PaymentRecord } from '../types/travel'
import { config } from '../config'

interface AgentDashboardProps {
  agentStatus: string
  payments: PaymentRecord[]
  totalSpent: string
}

function statusClass(s: string) {
  if (s === 'Idle') return 'idle'
  if (s === 'Error') return 'error'
  return ''
}

export function AgentDashboard({ agentStatus, payments, totalSpent }: AgentDashboardProps) {
  const explorerUrl = config.chains?.[48816]?.explorerUrl
  const cls = statusClass(agentStatus)

  return (
    <div className="dashboard-card">
      <p className="dashboard-title">⚡ Agent dashboard</p>
      <div className="dashboard-grid">
        <div className="stat-block">
          <p className="stat-label">Status</p>
          <div className={`status-pill ${cls}`}>
            <span className="status-dot" />
            {agentStatus}
          </div>
        </div>
        <div className="stat-block">
          <p className="stat-label">Payments</p>
          <p className="stat-value">{payments.length}</p>
        </div>
        <div className="stat-block">
          <p className="stat-label">Total spent</p>
          <p className="stat-value" style={{ color: 'var(--emerald)' }}>{totalSpent} USDT</p>
        </div>
      </div>

      {payments.length > 0 && (
        <div className="tx-list">
          <p className="tx-list-label">Transactions</p>
          {payments.map((p, i) => (
            <div key={i} className="tx-item">
              <span className="tx-id">{p.optionId}</span>
              <span className="tx-amount">{p.amount} USDT</span>
              {explorerUrl && p.txHash ? (
                <a
                  href={`${explorerUrl}/tx/${p.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tx-link"
                >
                  {p.txHash.slice(0, 8)}…
                </a>
              ) : (
                <span className="tx-link" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
                  {p.txHash?.slice(0, 8)}…
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
