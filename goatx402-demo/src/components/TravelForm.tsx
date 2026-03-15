/**
 * Payride travel search form
 */

import { useMemo } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import type { TripType, TripMode } from '../types/travel'

interface TravelFormProps {
  from: string
  setFrom: (v: string) => void
  to: string
  setTo: (v: string) => void
  destination: string
  setDestination: (v: string) => void
  startDate: string
  setStartDate: (v: string) => void
  endDate: string
  setEndDate: (v: string) => void
  tripMode: TripMode
  setTripMode: (m: TripMode) => void
  budget: string
  setBudget: (v: string) => void
  tripType: TripType
  setTripType: (v: TripType) => void
  onSearch: () => void
  searching: boolean
  isConnected: boolean
}

export function TravelForm({
  from,
  setFrom,
  to,
  setTo,
  destination,
  setDestination,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  tripMode,
  setTripMode,
  budget,
  setBudget,
  tripType,
  setTripType,
  onSearch,
  searching,
  isConnected,
}: TravelFormProps) {
  const selectedRange = useMemo(
    () =>
      startDate && endDate
        ? {
            from: new Date(startDate),
            to: new Date(endDate),
          }
        : undefined,
    [startDate, endDate]
  )

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200/80 p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Plan your trip</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSearch()
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">From</label>
              <input
                type="text"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="e.g. Chennai Central"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="e.g. Tiruvallur"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Destination city (for hotels)</label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Tokyo"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dates</label>
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2">
              <DayPicker
                mode="range"
                selected={selectedRange}
                onSelect={(range) => {
                  if (range?.from) {
                    setStartDate(range.from.toISOString().slice(0, 10))
                  }
                  if (range?.to) {
                    setEndDate(range.to.toISOString().slice(0, 10))
                  }
                }}
                numberOfMonths={1}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {startDate && endDate
                ? `From ${startDate} to ${endDate}`
                : 'Select your travel dates (or single day for one-way).'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Budget (USD)</label>
            <input
              type="number"
              min="0"
              step="50"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="500"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Trip mode</label>
            <div className="flex gap-2">
              {(['one_way', 'round_trip'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTripMode(mode)}
                  className={`flex-1 py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition ${
                    tripMode === mode
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {mode === 'one_way' ? 'One-way' : 'Round trip'}
                </button>
              ))}
            </div>
            {(tripType === 'flight' || tripType === 'train') && (
              <p className="mt-1 text-xs text-slate-500">
                Agent: I&apos;ll optimize your {tripType} as a {tripMode === 'one_way' ? 'one-way' : 'round-trip'} itinerary.
              </p>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Trip type</label>
          <div className="flex gap-2">
            {(['hotel', 'flight', 'train'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTripType(t)}
                className={`flex-1 py-2.5 px-4 rounded-lg border-2 font-medium capitalize transition ${
                  tripType === t
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={!isConnected || searching}
          className="w-full py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {searching ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Searching...
            </span>
          ) : (
            'Search'
          )}
        </button>
        {!isConnected && (
          <p className="text-center text-sm text-slate-500">Connect wallet (GOAT Testnet3) to search</p>
        )}
      </form>
    </div>
  )
}
