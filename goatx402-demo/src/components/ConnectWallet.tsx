/**
 * ConnectWallet — compact pill bar in the app header area
 */

interface ConnectWalletProps {
  isConnected: boolean
  address: string | null
  chainId: number | null
  loading: boolean
  error: string | null
  onConnect: () => void
  onDisconnect: () => void
}

export function ConnectWallet({
  isConnected,
  address,
  chainId,
  loading,
  error,
  onConnect,
  onDisconnect,
}: ConnectWalletProps) {
  const fmt = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`

  return (
    <div className="glass-card wallet-card">
      <div>
        <p className="wallet-label">Wallet</p>
        {isConnected && address ? (
          <>
            <p className="wallet-addr">{fmt(address)}</p>
            <p className="wallet-chain">Chain {chainId}</p>
          </>
        ) : (
          <p className="wallet-chain">Not connected</p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {isConnected && <span className="wallet-status-dot" />}
        {isConnected ? (
          <button className="btn-disconnect" onClick={onDisconnect}>
            Disconnect
          </button>
        ) : (
          <button className="btn-connect" onClick={onConnect} disabled={loading}>
            {loading ? 'Connecting…' : '🦊 Connect MetaMask'}
          </button>
        )}
      </div>

      {error && <p className="wallet-error">{error}</p>}
    </div>
  )
}
