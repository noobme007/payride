/**
 * AgentChat — conversational wizard with:
 *   • Inline two-month dark calendar for date picking
 *   • Icebreaker chips for every question step
 *   • Smart city suggestions, passengers, class, seat, budget chips
 *   • Itinerary summary card + confirm/edit flow
 *   • Session memory (remembers last "from" city)
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import type { TripType, TripMode } from '../types/travel'

/* ─────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────── */
export interface TripParams {
  tripType: TripType
  tripMode: TripMode
  from: string
  to: string
  destination: string
  startDate: string
  endDate: string
  budget: string
  passengers?: number
  travelClass?: string
  seatPref?: string
  hotelStars?: string
  departureTime?: string
}

interface AgentChatProps {
  onSearch: (params: TripParams) => void
  searching: boolean
  isConnected: boolean
}

type Step =
  | 'tripType'
  | 'tripMode'
  | 'passengers'
  | 'from'
  | 'to'
  | 'destination'
  | 'travelClass'
  | 'seatPref'
  | 'hotelStars'
  | 'dates'
  | 'departureTime'
  | 'budget'
  | 'confirm'

interface Message {
  id: number
  from: 'agent' | 'user'
  text: string
}

/* ─────────────────────────────────────────────────────────────
   Calendar helpers
───────────────────────────────────────────────────────────── */
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}
function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate()
}
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}
function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/* ─────────────────────────────────────────────────────────────
   Mini Calendar Component
───────────────────────────────────────────────────────────── */
interface CalendarProps {
  startDate: string
  endDate: string
  isRoundTrip: boolean
  onSelect: (start: string, end: string) => void
}

function CalendarPicker({ startDate, endDate, isRoundTrip, onSelect }: CalendarProps) {
  const today = startOfDay(new Date())
  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [hovered, setHovered] = useState<string | null>(null)

  const nextViewMonth = addMonths(viewMonth, 1)

  const handleDayClick = (iso: string) => {
    const clicked = new Date(iso + 'T00:00:00')
    if (clicked < today) return
    if (!startDate || (startDate && endDate)) {
      // First click or reset
      onSelect(iso, iso)
    } else {
      // Second click
      const s = new Date(startDate + 'T00:00:00')
      if (clicked < s) {
        onSelect(iso, startDate)
      } else {
        onSelect(startDate, iso)
      }
    }
  }

  const renderMonth = (baseDate: Date, slideClass: string) => {
    const y = baseDate.getFullYear()
    const m = baseDate.getMonth()
    const firstDay = new Date(y, m, 1).getDay()
    const total = daysInMonth(y, m)
    const cells: (Date | null)[] = Array(firstDay).fill(null)
    for (let d = 1; d <= total; d++) cells.push(new Date(y, m, d))

    return (
      <div className={`cal-month ${slideClass}`}>
        <p className="cal-month-name">{MONTHS[m]} {y}</p>
        <div className="cal-grid">
          {DAYS.map(d => <span key={d} className="cal-day-name">{d}</span>)}
          {cells.map((day, i) => {
            if (!day) return <span key={`e-${i}`} />
            const iso = isoDate(day)
            const isPast = day < today
            const isStart = iso === startDate
            const isEnd = iso === endDate
            const isSelected = isStart || isEnd
            const hov = hovered || endDate
            const inRange = startDate && hov && !isPast && iso > startDate && iso < hov
            const cls = [
              'cal-day',
              isPast ? 'cal-past' : '',
              isSelected ? 'cal-selected' : '',
              inRange ? 'cal-in-range' : '',
            ].filter(Boolean).join(' ')
            return (
              <button
                key={iso}
                className={cls}
                disabled={isPast}
                onClick={() => handleDayClick(iso)}
                onMouseEnter={() => !isPast && startDate && !endDate && setHovered(iso)}
                onMouseLeave={() => setHovered(null)}
              >
                {day.getDate()}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="cal-root">
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={() => setViewMonth(addMonths(viewMonth, -1))}>‹</button>
        <span />
        <button className="cal-nav-btn" onClick={() => setViewMonth(addMonths(viewMonth, 1))}>›</button>
      </div>
      <div className="cal-months">
        {renderMonth(viewMonth, '')}
        {renderMonth(nextViewMonth, '')}
      </div>
      {startDate && (
        <div className="cal-selection-hint">
          {isRoundTrip
            ? endDate && endDate !== startDate
              ? `✈️ ${fmtDate(startDate)} → ${fmtDate(endDate)}`
              : `📅 ${fmtDate(startDate)} — pick return date`
            : `📅 ${fmtDate(startDate)} selected`}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Data / Config
───────────────────────────────────────────────────────────── */
const POPULAR_CITIES = ['Chennai', 'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Kolkata', 'Pune']

const CITY_SUGGESTIONS: Record<string, string[]> = {
  Chennai:   ['Mumbai', 'Delhi', 'Bangalore', 'Tiruvallur', 'Coimbatore'],
  Mumbai:    ['Delhi', 'Bangalore', 'Chennai', 'Pune', 'Goa'],
  Delhi:     ['Mumbai', 'Bangalore', 'Chennai', 'Agra', 'Jaipur'],
  Bangalore: ['Mumbai', 'Chennai', 'Delhi', 'Hyderabad', 'Goa'],
  Hyderabad: ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Vijayawada'],
  Kolkata:   ['Delhi', 'Mumbai', 'Chennai', 'Bhubaneswar', 'Patna'],
  Pune:      ['Mumbai', 'Bangalore', 'Delhi', 'Goa', 'Hyderabad'],
}

const BUDGET_CHIPS = [
  { label: 'Under ₹500', value: '100' },
  { label: '₹500–₹2000', value: '350' },
  { label: '₹2000–₹5000', value: '750' },
  { label: '₹5000+', value: '1500' },
  { label: 'No limit', value: '9999' },
]

/* ─────────────────────────────────────────────────────────────
   Message ID
───────────────────────────────────────────────────────────── */
let _msgId = 0
const mkMsg = (from: 'agent' | 'user', text: string): Message => ({ id: ++_msgId, from, text })

/* ─────────────────────────────────────────────────────────────
   AgentChat
───────────────────────────────────────────────────────────── */
// Session memory: remember last "from" city
let _lastFrom = ''

export function AgentChat({ onSearch, searching, isConnected }: AgentChatProps) {
  const [step, setStep] = useState<Step>('tripType')
  const [messages, setMessages] = useState<Message[]>([
    mkMsg('agent', "Hi! I'm Payride AI ✦ Where are you heading today?"),
  ])
  const [params, setParams] = useState<Partial<TripParams>>({})
  const [customInput, setCustomInput] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [typing, setTyping] = useState(false)
  // Calendar state
  const [calStart, setCalStart] = useState('')
  const [calEnd, setCalEnd]     = useState('')

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing, step])

  /* ── Agent typing animation ─────────────────────────────── */
  const pushAgent = useCallback((text: string, delay = 550) => {
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      setMessages(p => [...p, mkMsg('agent', text)])
    }, delay)
  }, [])

  const pushUser = (text: string) =>
    setMessages(p => [...p, mkMsg('user', text)])

  /* ── Step transitions ────────────────────────────────────── */
  const goTo = useCallback((nextStep: Step, agentMsg: string, newParams?: Partial<TripParams>) => {
    if (newParams) setParams(p => ({ ...p, ...newParams }))
    setStep(nextStep)
    setShowCustomInput(false)
    setCustomInput('')
    pushAgent(agentMsg)
  }, [pushAgent])

  /* ── Trip type ──────────────────────────────────────────── */
  const selectTripType = (t: TripType, label: string) => {
    pushUser(label)
    const next: Partial<TripParams> = { tripType: t, destination: '' }
    if (t === 'hotel') {
      setParams(p => ({ ...p, ...next }))
      setStep('hotelStars')
      pushAgent('Great choice! What star rating are you looking for? ⭐')
    } else if (t === 'flight') {
      setParams(p => ({ ...p, ...next }))
      setStep('tripMode')
      pushAgent('Perfect! One-way or round-trip? ✈️')
    } else {
      // train or bus
      setParams(p => ({ ...p, ...next }))
      setStep('tripMode')
      pushAgent(`${t === 'train' ? '🚂' : '🚌'} One-way or round-trip?`)
    }
  }

  /* ── Trip mode ──────────────────────────────────────────── */
  const selectTripMode = (m: TripMode, label: string) => {
    pushUser(label)
    setParams(p => ({ ...p, tripMode: m }))
    setStep('passengers')
    pushAgent('How many passengers? 👥')
  }

  /* ── Passengers ─────────────────────────────────────────── */
  const selectPassengers = (n: number, label: string) => {
    pushUser(label)
    setParams(p => ({ ...p, passengers: n }))
    // show from with memory
    setStep('from')
    const hint = _lastFrom ? ` (or tap "${_lastFrom}" to reuse)` : ''
    pushAgent(`Where are you departing from?${hint}`)
  }

  /* ── City from ──────────────────────────────────────────── */
  const selectFrom = (city: string) => {
    pushUser(city)
    _lastFrom = city
    setParams(p => ({ ...p, from: city }))
    setStep('to')
    pushAgent('And where are you headed?')
  }

  /* ── City to ────────────────────────────────────────────── */
  const selectTo = (city: string) => {
    pushUser(city)
    setParams(p => ({ ...p, to: city, destination: city }))
    const t = params.tripType
    if (t === 'flight') {
      setStep('travelClass')
      pushAgent('What travel class? 💺')
    } else if (t === 'train') {
      setStep('seatPref')
      pushAgent('Seat preference? 🚂')
    } else {
      // bus / mixed
      setStep('dates')
      pushAgent('When do you want to travel? Pick your date(s) on the calendar 📅')
    }
  }

  /* ── Hotel stars ────────────────────────────────────────── */
  const selectHotelStars = (stars: string, label: string) => {
    pushUser(label)
    setParams(p => ({ ...p, hotelStars: stars }))
    setStep('destination')
    pushAgent('Which city are you looking for a hotel in? 🏙️')
  }

  /* ── Destination (hotels) ───────────────────────────────── */
  const selectDestination = (city: string) => {
    pushUser(city)
    setParams(p => ({ ...p, destination: city, from: city, to: city }))
    setStep('dates')
    pushAgent('When are you staying? Pick your check-in/out dates 📅')
  }

  /* ── Travel class ───────────────────────────────────────── */
  const selectTravelClass = (cls: string, label: string) => {
    pushUser(label)
    setParams(p => ({ ...p, travelClass: cls }))
    setStep('dates')
    pushAgent('When do you want to fly? Pick your dates 📅')
  }

  /* ── Seat pref ──────────────────────────────────────────── */
  const selectSeatPref = (seat: string, label: string) => {
    pushUser(label)
    setParams(p => ({ ...p, seatPref: seat }))
    setStep('dates')
    pushAgent('When do you want to travel? Pick your date(s) 📅')
  }

  /* ── Calendar confirm ───────────────────────────────────── */
  const confirmDates = () => {
    if (!calStart) return
    const end = calEnd || calStart
    const isRound = params.tripMode === 'round_trip'
    const label = isRound && end !== calStart
      ? `✈️ ${fmtDate(calStart)} → ${fmtDate(end)}`
      : `📅 ${fmtDate(calStart)}`
    pushUser(label)
    setParams(p => ({ ...p, startDate: calStart, endDate: end }))
    setStep('departureTime')
    pushAgent('Any departure time preference? 🕐')
  }

  /* ── Departure time ─────────────────────────────────────── */
  const selectDepartureTime = (time: string, label: string) => {
    pushUser(label)
    setParams(p => ({ ...p, departureTime: time }))
    setStep('budget')
    pushAgent('What is your budget? 💰')
  }

  /* ── Budget ─────────────────────────────────────────────── */
  const selectBudget = (val: string, label: string) => {
    pushUser(label)
    const final = buildFinal({ ...params, budget: val })
    setParams(final)
    setStep('confirm')
    pushAgent('Here is your trip summary — confirm to search!')
  }

  /* ── Build final params ──────────────────────────────────── */
  const buildFinal = (p: Partial<TripParams>): TripParams => ({
    tripType: p.tripType || 'train',
    tripMode: p.tripMode || 'one_way',
    from: p.from || '',
    to: p.to || '',
    destination: p.destination || p.to || '',
    startDate: p.startDate || '',
    endDate: p.endDate || p.startDate || '',
    budget: p.budget || '500',
    passengers: p.passengers,
    travelClass: p.travelClass,
    seatPref: p.seatPref,
    hotelStars: p.hotelStars,
    departureTime: p.departureTime,
  })

  /* ── Confirm search ──────────────────────────────────────── */
  const confirmSearch = () => {
    if (!isConnected) return
    onSearch(buildFinal(params))
    pushUser("✅ Confirmed — search it!")
    pushAgent("🔍 On it! Scanning for the best options…", 400)
  }

  /* ── Custom text submit ──────────────────────────────────── */
  const handleCustomSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    const val = customInput.trim()
    if (!val) return
    setCustomInput('')
    setShowCustomInput(false)
    switch (step) {
      case 'from':        selectFrom(val); break
      case 'to':          selectTo(val); break
      case 'destination': selectDestination(val); break
      default: break
    }
  }

  /* ── Restart ─────────────────────────────────────────────── */
  const restart = () => {
    _msgId = 0
    setStep('tripType')
    setParams({})
    setCustomInput('')
    setShowCustomInput(false)
    setCalStart('')
    setCalEnd('')
    setMessages([mkMsg('agent', "Hi! I'm Payride AI ✦ Where are you heading today?")])
  }

  /* ── Summary card ────────────────────────────────────────── */
  const SummaryCard = () => {
    const p = params
    const icon = p.tripType === 'hotel' ? '🏨' : p.tripType === 'flight' ? '✈️' : p.tripType === 'train' ? '🚂' : '🚌'
    const route = p.tripType === 'hotel'
      ? p.destination || '—'
      : `${p.from || '—'} → ${p.to || '—'}`
    const dates = p.startDate
      ? p.endDate && p.endDate !== p.startDate ? `${fmtDate(p.startDate)} → ${fmtDate(p.endDate)}` : fmtDate(p.startDate)
      : '—'
    const extra = p.travelClass || p.seatPref || ''
    const pax = p.passengers || 1
    return (
      <div className="summary-card">
        <div className="summary-top">
          <span className="summary-icon">{icon}</span>
          <div>
            <p className="summary-route">{route}</p>
            <p className="summary-meta">{dates} · {pax} pax{extra ? ` · ${extra}` : ''}</p>
            {p.hotelStars && <p className="summary-meta">{p.hotelStars} · Budget: {BUDGET_CHIPS.find(b=>b.value===p.budget)?.label || `$${p.budget}`}</p>}
            {!p.hotelStars && <p className="summary-meta">Budget: {BUDGET_CHIPS.find(b=>b.value===p.budget)?.label || `$${p.budget}`}</p>}
          </div>
        </div>
        <div className="summary-actions">
          <button
            className="chip chip-confirm"
            onClick={confirmSearch}
            disabled={!isConnected || searching}
          >
            {searching ? '⏳ Searching…' : '✅ Confirm & Search'}
          </button>
          <button className="chip chip-edit" onClick={restart}>✏️ Start over</button>
        </div>
      </div>
    )
  }

  const fromCity = params.from || ''
  const toSuggestions = CITY_SUGGESTIONS[fromCity] || POPULAR_CITIES.filter(c => c !== fromCity)

  return (
    <div className="agent-chat-card">
      {/* Header */}
      <div className="agent-chat-header">
        <div className="agent-avatar">✦</div>
        <div>
          <p className="agent-name">Payride AI</p>
          <p className="agent-subtitle">Autonomous travel agent</p>
        </div>
        <button className="restart-btn" onClick={restart} title="Restart conversation">↺</button>
      </div>

      {/* Messages */}
      <div className="agent-messages">
        {messages.map(m => (
          <div key={m.id} className={`chat-bubble-wrap ${m.from}`}>
            {m.from === 'agent' && <div className="bubble-avatar">✦</div>}
            <div className={`chat-bubble ${m.from}`}>
              {m.text.split('\n').map((line, i, arr) => (
                <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
              ))}
            </div>
          </div>
        ))}

        {typing && (
          <div className="chat-bubble-wrap agent">
            <div className="bubble-avatar">✦</div>
            <div className="chat-bubble agent typing-dots"><span /><span /><span /></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Chips / Inputs per step ─────────────────────────── */}
      {!typing && (
        <>
          {/* TRIP TYPE */}
          {step === 'tripType' && (
            <div className="chip-row">
              <button className="chip" onClick={() => selectTripType('train',  '🚂 Train')}>🚂 Train</button>
              <button className="chip" onClick={() => selectTripType('flight', '✈️ Flight')}>✈️ Flight</button>
              <button className="chip" onClick={() => selectTripType('hotel',  '🏨 Hotel')}>🏨 Hotel</button>
              <button className="chip chip-dim" onClick={() => selectTripType('train', '🚌 Bus')}>🚌 Bus</button>
              <button className="chip chip-dim" onClick={() => selectTripType('flight', '🔀 Mixed')}>🔀 Mixed</button>
            </div>
          )}

          {/* TRIP MODE */}
          {step === 'tripMode' && (
            <div className="chip-row">
              <button className="chip" onClick={() => selectTripMode('one_way',    '→ One-way')}>→ One-way</button>
              <button className="chip" onClick={() => selectTripMode('round_trip', '⇄ Round-trip')}>⇄ Round-trip</button>
              <button className="chip chip-dim" onClick={() => selectTripMode('one_way', '🗺️ Multi-city')}>🗺️ Multi-city</button>
            </div>
          )}

          {/* PASSENGERS */}
          {step === 'passengers' && (
            <div className="chip-row">
              {[1,2,3,4].map(n => (
                <button key={n} className="chip" onClick={() => selectPassengers(n, `${n} person${n>1?'s':''}`)}>
                  {n} {n > 1 ? 'People' : 'Person'}
                </button>
              ))}
              <button className="chip chip-dim" onClick={() => selectPassengers(5, '5+ People')}>5+ People</button>
            </div>
          )}

          {/* FROM */}
          {step === 'from' && (
            <div className="chip-col">
              <div className="chip-row">
                {_lastFrom && (
                  <button className="chip chip-memory" onClick={() => selectFrom(_lastFrom)}>
                    ⭐ {_lastFrom}
                  </button>
                )}
                {POPULAR_CITIES.filter(c => c !== _lastFrom).slice(0, 5).map(c => (
                  <button key={c} className="chip" onClick={() => selectFrom(c)}>{c}</button>
                ))}
                <button className="chip chip-dim" onClick={() => setShowCustomInput(true)}>+ Type city</button>
              </div>
              {showCustomInput && (
                <form className="agent-input-row" onSubmit={handleCustomSubmit}>
                  <input ref={inputRef} className="agent-input" value={customInput}
                    onChange={e => setCustomInput(e.target.value)}
                    placeholder="Enter city name…" autoFocus />
                  <button type="submit" className="agent-send">↑</button>
                </form>
              )}
            </div>
          )}

          {/* TO */}
          {step === 'to' && (
            <div className="chip-col">
              <div className="chip-row">
                {toSuggestions.slice(0, 5).map(c => (
                  <button key={c} className="chip" onClick={() => selectTo(c)}>{c}</button>
                ))}
                <button className="chip chip-dim" onClick={() => setShowCustomInput(true)}>+ Type city</button>
              </div>
              {showCustomInput && (
                <form className="agent-input-row" onSubmit={handleCustomSubmit}>
                  <input ref={inputRef} className="agent-input" value={customInput}
                    onChange={e => setCustomInput(e.target.value)}
                    placeholder="Enter destination city…" autoFocus />
                  <button type="submit" className="agent-send">↑</button>
                </form>
              )}
            </div>
          )}

          {/* DESTINATION (hotels) */}
          {step === 'destination' && (
            <div className="chip-col">
              <div className="chip-row">
                {POPULAR_CITIES.slice(0, 5).map(c => (
                  <button key={c} className="chip" onClick={() => selectDestination(c)}>{c}</button>
                ))}
                <button className="chip chip-dim" onClick={() => setShowCustomInput(true)}>+ Type city</button>
              </div>
              {showCustomInput && (
                <form className="agent-input-row" onSubmit={handleCustomSubmit}>
                  <input ref={inputRef} className="agent-input" value={customInput}
                    onChange={e => setCustomInput(e.target.value)}
                    placeholder="Enter city name…" autoFocus />
                  <button type="submit" className="agent-send">↑</button>
                </form>
              )}
            </div>
          )}

          {/* HOTEL STARS */}
          {step === 'hotelStars' && (
            <div className="chip-row">
              {[
                { label: '⭐ Any',         val: 'any' },
                { label: '⭐⭐ 2-Star',    val: '2star' },
                { label: '⭐⭐⭐ 3-Star',  val: '3star' },
                { label: '⭐⭐⭐⭐ 4-Star',val: '4star' },
                { label: '🌟 5-Star',      val: '5star' },
              ].map(o => (
                <button key={o.val} className="chip" onClick={() => selectHotelStars(o.val, o.label)}>{o.label}</button>
              ))}
            </div>
          )}

          {/* TRAVEL CLASS */}
          {step === 'travelClass' && (
            <div className="chip-row">
              {[
                { label: '💺 Economy',    val: 'economy' },
                { label: '🥇 Business',   val: 'business' },
                { label: '👑 First Class',val: 'first' },
              ].map(o => (
                <button key={o.val} className="chip" onClick={() => selectTravelClass(o.val, o.label)}>{o.label}</button>
              ))}
            </div>
          )}

          {/* SEAT PREF */}
          {step === 'seatPref' && (
            <div className="chip-row">
              {[
                { label: '🪑 Sleeper', val: 'SL' },
                { label: '💺 3AC',    val: '3AC' },
                { label: '🛏️ 2AC',   val: '2AC' },
                { label: '👑 1AC',    val: '1AC' },
                { label: '💺 General',val: 'GEN' },
              ].map(o => (
                <button key={o.val} className="chip" onClick={() => selectSeatPref(o.val, o.label)}>{o.label}</button>
              ))}
            </div>
          )}

          {/* DATES — custom calendar */}
          {step === 'dates' && (
            <div className="cal-container">
              <CalendarPicker
                startDate={calStart}
                endDate={calEnd}
                isRoundTrip={params.tripMode === 'round_trip'}
                onSelect={(s, e) => {
                  setCalStart(s)
                  setCalEnd(e)
                }}
              />
              {calStart && (
                <div className="chip-row" style={{ borderTop: 'none', paddingTop: 0 }}>
                  <button
                    className="chip chip-primary"
                    onClick={confirmDates}
                  >
                    Confirm dates →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* DEPARTURE TIME */}
          {step === 'departureTime' && (
            <div className="chip-row">
              {[
                { label: '🌅 Early Morning', val: 'early_morning' },
                { label: '☀️ Morning',        val: 'morning' },
                { label: '🌤️ Afternoon',      val: 'afternoon' },
                { label: '🌙 Evening',         val: 'evening' },
                { label: '🌃 Night',           val: 'night' },
                { label: '🔀 Any time',        val: 'any' },
              ].map(o => (
                <button key={o.val} className="chip" onClick={() => selectDepartureTime(o.val, o.label)}>{o.label}</button>
              ))}
            </div>
          )}

          {/* BUDGET */}
          {step === 'budget' && (
            <div className="chip-row">
              {BUDGET_CHIPS.map(b => (
                <button key={b.value} className="chip" onClick={() => selectBudget(b.value, b.label)}>{b.label}</button>
              ))}
            </div>
          )}

          {/* CONFIRM — summary card */}
          {step === 'confirm' && <SummaryCard />}
        </>
      )}

      {!isConnected && (
        <p className="agent-warn">⚠️ Connect your wallet to enable search & booking.</p>
      )}
    </div>
  )
}
