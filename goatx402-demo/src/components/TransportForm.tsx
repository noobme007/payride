/**
 * TransportForm — step-through form for Transport mode
 */

import { useState } from 'react'
import { CalendarPicker } from './CalendarPicker'
import type { SearchParams } from '../App'

interface Props {
  onSearch: (p: SearchParams) => void
  searching: boolean
  isConnected: boolean
}

type TStep = 'type' | 'route' | 'date' | 'passengers' | 'class' | 'time'

const TRANSPORT_TYPES = [
  { label: '🚂 Train',            val: 'train' as const },
  { label: '🚌 Bus',              val: 'train' as const },  // mapped to train for API
  { label: '🔀 Best Route',       val: 'train' as const },
]
const POPULAR_FROM = ['Chennai', 'Tiruvallur', 'Tambaram', 'Avadi', 'Kanchipuram', 'Vellore']
const POPULAR_TO   = ['Tiruvallur', 'Chennai', 'Tambaram', 'Avadi', 'Kanchipuram', 'Vellore']
const PAX = ['1', '2', '3', '4', '5+']
const CLASSES = [
  { label: '💺 General',  val: 'GEN' },
  { label: '🪑 Sleeper',  val: 'SL' },
  { label: '💺 3AC',      val: '3AC' },
  { label: '🛏️ 2AC',     val: '2AC' },
  { label: '👑 1AC',      val: '1AC' },
]
const TIMES = [
  { label: '🌅 Early (5–9am)',      val: 'early' },
  { label: '☀️ Morning (9–12)',      val: 'morning' },
  { label: '🌤️ Afternoon (12–5)',   val: 'afternoon' },
  { label: '🌙 Evening (5–10)',      val: 'evening' },
  { label: '🔀 Any time',           val: 'any' },
]

const STEPS: TStep[] = ['type', 'route', 'date', 'passengers', 'class', 'time']
const STEP_LABELS: Record<TStep, string> = {
  type:       'How do you want to travel?',
  route:      'From → To',
  date:       'When are you travelling?',
  passengers: 'How many passengers?',
  class:      'Travel class?',
  time:       'Departure time preference?',
}

export function TransportForm({ onSearch, searching, isConnected }: Props) {
  const [step, setStep]   = useState<TStep>('type')
  const [params, setParams] = useState<Partial<SearchParams>>({ tripType: 'train', tripMode: 'one_way' })
  const [fromCity, setFromCity] = useState('')
  const [toCity, setToCity]   = useState('')
  const [calDate, setCalDate] = useState('')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]   = useState('')
  const [showFrom, setShowFrom] = useState(false)
  const [showTo, setShowTo]   = useState(false)
  const [swapped, setSwapped] = useState(false)

  const stepIdx = STEPS.indexOf(step)

  const advance = (updates: Partial<SearchParams>, next: TStep) => {
    setParams(p => ({ ...p, ...updates }))
    setStep(next)
  }

  const swap = () => {
    const tmp = fromCity
    setFromCity(toCity)
    setToCity(tmp)
    setSwapped(v => !v)
  }

  const pickFrom = (city: string) => {
    setFromCity(city)
    setShowFrom(false)
  }
  const pickTo = (city: string) => {
    setToCity(city)
    setShowTo(false)
  }

  const routeReady = fromCity && toCity && fromCity !== toCity
  const confirmRoute = () => {
    if (!routeReady) return
    advance({ from: fromCity, to: toCity, destination: toCity }, 'date')
  }

  const doSearch = (time: string) => {
    const final: SearchParams = {
      tripType:       params.tripType || 'train',
      tripMode:       'one_way',
      from:           fromCity,
      to:             toCity,
      destination:    toCity,
      startDate:      calDate,
      endDate:        calDate,
      budget:         params.budget || '500',
      passengers:     parseInt(params.passengers?.toString() || '1'),
      travelClass:    params.travelClass,
      departureTime:  time,
    }
    onSearch(final)
  }

  const go = (idx: number) => { if (idx < stepIdx) setStep(STEPS[idx]) }

  return (
    <div className="form-panel">
      {/* Progress dots */}
      <div className="step-progress">
        {STEPS.map((s, i) => (
          <button key={s}
            className={`step-dot ${i === stepIdx ? 'active' : ''} ${i < stepIdx ? 'done' : ''}`}
            onClick={() => go(i)}
            title={STEP_LABELS[s]}
          />
        ))}
      </div>

      <div className="form-step-label">{STEP_LABELS[step]}</div>

      {/* TYPE */}
      {step === 'type' && (
        <div className="chip-wrap">
          {TRANSPORT_TYPES.map(t => (
            <button key={t.label} className="chip-flat chip-transport"
              onClick={() => advance({ tripType: t.val }, 'route')}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ROUTE */}
      {step === 'route' && (
        <div className="route-panel">
          {/* FROM */}
          <div className="route-field">
            <label className="route-label">FROM</label>
            <div className={`route-value ${fromCity ? 'filled' : ''}`}>
              {fromCity || 'Select city'}
            </div>
            <div className="chip-wrap tight">
              {POPULAR_FROM.filter(c => c !== toCity).slice(0, 5).map(c => (
                <button key={c} className={`chip-flat chip-sm ${fromCity === c ? 'selected' : ''}`}
                  onClick={() => pickFrom(c)}>{c}</button>
              ))}
              <button className="chip-flat chip-sm chip-dim" onClick={() => setShowFrom(v => !v)}>+</button>
            </div>
            {showFrom && (
              <div className="custom-input-row">
                <input className="form-text-input" value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  placeholder="Enter city…"
                  onKeyDown={e => { if (e.key === 'Enter' && customFrom.trim()) { pickFrom(customFrom.trim()); setCustomFrom('') } }}
                  autoFocus />
                <button className="btn-inline" onClick={() => { if (customFrom.trim()) { pickFrom(customFrom.trim()); setCustomFrom('') } }}>→</button>
              </div>
            )}
          </div>

          {/* Swap */}
          <button className="swap-btn" onClick={swap}
            style={{ transform: swapped ? 'rotate(180deg)' : 'rotate(0)' }}>⇄</button>

          {/* TO */}
          <div className="route-field">
            <label className="route-label">TO</label>
            <div className={`route-value ${toCity ? 'filled' : ''}`}>
              {toCity || 'Select city'}
            </div>
            <div className="chip-wrap tight">
              {POPULAR_TO.filter(c => c !== fromCity).slice(0, 5).map(c => (
                <button key={c} className={`chip-flat chip-sm ${toCity === c ? 'selected' : ''}`}
                  onClick={() => pickTo(c)}>{c}</button>
              ))}
              <button className="chip-flat chip-sm chip-dim" onClick={() => setShowTo(v => !v)}>+</button>
            </div>
            {showTo && (
              <div className="custom-input-row">
                <input className="form-text-input" value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  placeholder="Enter city…"
                  onKeyDown={e => { if (e.key === 'Enter' && customTo.trim()) { pickTo(customTo.trim()); setCustomTo('') } }}
                  autoFocus />
                <button className="btn-inline" onClick={() => { if (customTo.trim()) { pickTo(customTo.trim()); setCustomTo('') } }}>→</button>
              </div>
            )}
          </div>

          <button
            className={`btn-primary btn-full mt-8 ${!routeReady ? 'disabled' : ''}`}
            disabled={!routeReady}
            onClick={confirmRoute}
          >
            {fromCity && toCity ? `${fromCity} → ${toCity}  Confirm →` : 'Pick cities above'}
          </button>
        </div>
      )}

      {/* DATE */}
      {step === 'date' && (
        <div>
          <CalendarPicker
            mode="single"
            startDate={calDate}
            endDate={calDate}
            onSelect={(s) => setCalDate(s)}
          />
          {calDate && (
            <button className="btn-primary btn-full mt-8"
              onClick={() => advance({ startDate: calDate, endDate: calDate }, 'passengers')}>
              Confirm date →
            </button>
          )}
        </div>
      )}

      {/* PASSENGERS */}
      {step === 'passengers' && (
        <div className="chip-wrap">
          {PAX.map(n => (
            <button key={n} className="chip-flat"
              onClick={() => advance({ passengers: n === '5+' ? 5 : parseInt(n) }, 'class')}>
              {n} {parseInt(n) === 1 ? 'Passenger' : 'Passengers'}
            </button>
          ))}
        </div>
      )}

      {/* CLASS */}
      {step === 'class' && (
        <div className="chip-wrap">
          {CLASSES.map(c => (
            <button key={c.val} className="chip-flat"
              onClick={() => advance({ travelClass: c.val }, 'time')}>
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* TIME */}
      {step === 'time' && (
        <div className="chip-wrap">
          {TIMES.map(t => (
            <button key={t.val} className="chip-flat"
              onClick={() => doSearch(t.val)}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="form-footer">
        {stepIdx > 0 && (
          <button className="btn-ghost" onClick={() => setStep(STEPS[stepIdx - 1])}>
            ← Back
          </button>
        )}
      </div>

      {!isConnected && <p className="form-warn">⚠️ Connect wallet to book</p>}
    </div>
  )
}
