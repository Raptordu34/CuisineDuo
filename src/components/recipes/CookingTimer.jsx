import { useState, useEffect, useRef, useCallback } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

export default function CookingTimer({ durationMinutes, onDone }) {
  const { t } = useLanguage()
  const totalMs = durationMinutes * 60 * 1000
  const [remaining, setRemaining] = useState(totalMs)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const startTimeRef = useRef(null)
  const pausedRemainingRef = useRef(totalMs)
  const rafRef = useRef(null)

  const tick = useCallback(() => {
    if (!startTimeRef.current) return
    const elapsed = Date.now() - startTimeRef.current
    const left = Math.max(0, pausedRemainingRef.current - elapsed)
    setRemaining(left)

    if (left <= 0) {
      setRunning(false)
      setFinished(true)
      // Vibrate
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200])
      }
      // Sound
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const osc = ctx.createOscillator()
        osc.frequency.value = 880
        osc.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.5)
      } catch {
        // no audio
      }
      if (onDone) onDone()
      return
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [onDone])

  useEffect(() => {
    if (running) {
      startTimeRef.current = Date.now()
      rafRef.current = requestAnimationFrame(tick)
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [running, tick])

  const handleStart = () => {
    if (finished) {
      // Reset first
      pausedRemainingRef.current = totalMs
      setRemaining(totalMs)
      setFinished(false)
    }
    setRunning(true)
  }

  const handlePause = () => {
    setRunning(false)
    pausedRemainingRef.current = remaining
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }

  const handleReset = () => {
    setRunning(false)
    setFinished(false)
    pausedRemainingRef.current = totalMs
    setRemaining(totalMs)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }

  const mins = Math.floor(remaining / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)
  const progress = totalMs > 0 ? 1 - remaining / totalMs : 0
  const circumference = 2 * Math.PI * 45
  const strokeDashoffset = circumference * (1 - progress)

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Circular progress */}
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="6" />
          <circle
            cx="50" cy="50" r="45" fill="none"
            stroke={finished ? '#ef4444' : '#22c55e'}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-[stroke-dashoffset] duration-200"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xl font-bold tabular-nums ${finished ? 'text-red-500 animate-pulse' : 'text-gray-900'}`}>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </span>
        </div>
      </div>

      {finished && (
        <p className="text-sm font-medium text-red-500">{t('recipes.timerDone')}</p>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2">
        {!running ? (
          <button
            onClick={handleStart}
            className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-full text-sm font-medium transition-colors cursor-pointer"
          >
            {finished ? t('recipes.timerReset') : remaining < totalMs ? t('recipes.timerResume') : t('recipes.startTimer')}
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="px-4 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-full text-sm font-medium transition-colors cursor-pointer"
          >
            {t('recipes.timerPause')}
          </button>
        )}
        {(remaining < totalMs || finished) && (
          <button
            onClick={handleReset}
            className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-full text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
          >
            {t('recipes.timerReset')}
          </button>
        )}
      </div>
    </div>
  )
}
