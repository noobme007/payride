/**
 * VacationForm — step-through form for Vacation mode
 */

import { useState } from 'react'
import { CalendarPicker } from './CalendarPicker'
import type { SearchParams } from '../App'

interface Props {
  onSearch: (p: SearchParams) => void
  searching: boolean
  isConnected: boolean
}

type VStep = 'style' | 'destination' | 'dates' | 'group' | 'budget' | 'hotel'

const STYLES = [
  { label: '🏖️ Beach Getaway', val: 'beach' },
  { label: '🏔️ Hill Station',  val: 'hill' },
  { label: '🏙️ City Trip',     val: 'city' },
  { label: '🌿 Nature & Trek', val: 'nature' },
]
const DESTINATIONS = ['Goa', 'Manali', 'Ooty', 'Mumbai', 'Jaipur', 'Coorg', 'Shimla', 'Pondicherry']
const GROUPS = [
  { label: '🧍 Solo',          val: '1' },
  { label: '👫 Couple',        val: '2' },
  { label: '👨‍👩‍👦 Family 3',   val: '3' },
  { label: '👨‍👩‍👧‍👦 Family 4', val: '4' },
  { label: '🎉 Group 5+',      val: '5' },
]
const BUDGETS = [
  { label: 'Under ₹5,000',   val: '100' },
  { label: '₹5k–₹15k',      val: '300' },
  { label: '₹15k–₹30k',     val: '700' },
  { label: '₹30k+',          val: '1500' },
]
const HOTEL_STARS = [
  { label: '⭐ Budget',      val: '2star' },
  { label: '⭐⭐⭐ Mid',     val: '3star' },
  { label: '⭐⭐⭐⭐ Premium',val: '4star' },
  { label: '🌟 Luxury',      val: '5star' },
]

const STEPS: VStep[] = ['style', 'destination', 'dates', 'group', 'budget', 'hotel']
const STEP_LABELS: Record<VStep, string> = {
  style:       'What kind of vacation?',
  destination: 'Where to?',
  dates:       'When are you going?',
  group:       'How many people?',
  budget:      'What is your budget?',
  hotel:       'Hotel preference?',
}

export function VacationForm({ onSearch, searching, isConnected }: Props) {
  const [step, setStep] = useState<VStep>('style')
  const [params, setParams] = useState<Partial<SearchParams>>({ tripType: 'hotel', tripMode: 'one_way' })
  const [calStart, setCalStart] = useState('')
  const [calEnd, setCalEnd] = useState('')
  const [customDest, setCustomDest] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const stepIdx = STEPS.indexOf(step)

  const advance = (updates: Partial<SearchParams>, next: VStep) => {
    setParams(p => ({ ...p, ...updates }))
    setStep(next)
  }

  const handleDates = () => {
    if (!calStart) return
    const end = calEnd || calStart
    advance({ startDate: calStart, endDate: end }, 'group')
  }

  const go = (idx: number) => {
    if (idx < stepIdx) setStep(STEPS[idx])
  }

  const doSearch = (stars: string) => {
    const final: SearchParams = {
      tripType:    'hotel',
      tripMode:    'one_way',
      from:        params.destination || '',
      to:          params.destination || '',
      destination: params.destination || '',
      startDate:   calStart || '',
      endDate:     calEnd || calStart || '',
      budget:      params.budget || '500',
      passengers:  parseInt(params.passengers?.toString() || '1'),
      hotelStars:  stars,
    }
    onSearch(final)
  }

  return (
    <div className="form-panel">
      {/* Progress breadcrumb */}
      <div className="step-progress">
        {STEPS.map((s, i) => (
          <button
            key={s}
            className={`step-dot ${i === stepIdx ? 'active' : ''} ${i < stepIdx ? 'done' : ''}`}
            onClick={() => go(i)}
            title={STEP_LABELS[s]}
          />
        ))}
      </div>

      <div className="form-step-label animate-slide-up" key={step}>{STEP_LABELS[step]}</div>

      {/* STYLE */}
      {step === 'style' && (
        <div className="chips-2col animate-pop">
          {STYLES.map(s => (
            <button key={s.val} className="chip-flat"
              onClick={() => advance({ tripType: 'hotel' }, 'destination')}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* DESTINATION */}
      {step === 'destination' && (
        <div className="chip-wrap animate-pop">
          {DESTINATIONS.map(d => (
            <button key={d} className="chip-flat"
              onClick={() => advance({ destination: d }, 'dates')}>
              {d}
            </button>
          ))}
          <button className="chip-flat chip-dim" onClick={() => setShowCustom(v => !v)}>
            + Other
          </button>
          {showCustom && (
            <div className="custom-input-row">
              <input
                className="form-text-input"
                value={customDest}
                onChange={e => setCustomDest(e.target.value)}
                placeholder="Type destination…"
                onKeyDown={e => {
                  if (e.key === 'Enter' && customDest.trim()) {
                    advance({ destination: customDest.trim() }, 'dates')
                  }
                }}
                autoFocus
              />
              <button className="btn-inline"
                onClick={() => customDest.trim() && advance({ destination: customDest.trim() }, 'dates')}>
                →
              </button>
            </div>
          )}
        </div>
      )}

      {/* DATES */}
      {step === 'dates' && (
        <div className="animate-pop">
          <CalendarPicker
            mode="range"
            startDate={calStart}
            endDate={calEnd}
            onSelect={(s, e) => { setCalStart(s); setCalEnd(e) }}
          />
          {calStart && (
            <button className="btn-primary btn-full mt-8" onClick={handleDates}>
              Confirm dates →
            </button>
          )}
        </div>
      )}

      {/* GROUP */}
      {step === 'group' && (
        <div className="chip-wrap animate-pop">
          {GROUPS.map(g => (
            <button key={g.val} className="chip-flat"
              onClick={() => advance({ passengers: parseInt(g.val) }, 'budget')}>
              {g.label}
            </button>
          ))}
        </div>
      )}

      {/* BUDGET */}
      {step === 'budget' && (
        <div className="chip-wrap animate-pop">
          {BUDGETS.map(b => (
            <button key={b.val} className="chip-flat"
              onClick={() => advance({ budget: b.val }, 'hotel')}>
              {b.label}
            </button>
          ))}
        </div>
      )}

      {/* HOTEL STARS */}
      {step === 'hotel' && (
        <div className="chip-wrap animate-pop">
          {HOTEL_STARS.map(h => (
            <button key={h.val} className="chip-flat"
              onClick={() => doSearch(h.val)}>
              {h.label}
            </button>
          ))}
        </div>
      )}

      {/* Bottom actions */}
      <div className="form-footer">
        {stepIdx > 0 && (
          <button className="btn-ghost" onClick={() => setStep(STEPS[stepIdx - 1])}>
            ← Back
          </button>
        )}
      </div>

      {!isConnected && (
        <p className="form-warn">⚠️ Connect wallet to book</p>
      )}
    </div>
  )
}
