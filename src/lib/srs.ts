/* ── Spaced repetition engine (SM-2 variant, no AI — pure scheduling) ─
   Ratings: 1 Again · 2 Hard · 3 Good · 4 Easy
   Intervals in days; 0 means a short in-session learning step (10 min).   */

import type { Rating, ReviewItem } from './types'

const MIN_EASE = 1.3
const AGAIN_STEP_MS = 10 * 60 * 1000
export const DAY_MS = 86_400_000

export interface Sched {
  ease: number
  interval: number
  reps: number
  lapses: number
  state: ReviewItem['state']
  due: number
}

function clampEase(e: number) {
  return Math.max(MIN_EASE, Math.min(3.5, e))
}

function graduating(r: ReviewItem, rating: Rating): { interval: number; ease: number } {
  const prev = r.interval
  if (r.state === 'relearning' && prev > 0) {
    // re-graduating after a lapse: rebuild from a fraction of the old interval
    if (rating === 2) return { interval: Math.max(1, Math.round(prev * 0.5)), ease: clampEase(r.ease - 0.15) }
    if (rating === 3) return { interval: Math.max(1, Math.round(prev * 0.7)), ease: r.ease }
    return { interval: Math.max(1, Math.round(prev * 0.9)), ease: clampEase(r.ease + 0.15) }
  }
  if (rating === 2) return { interval: 1, ease: clampEase(r.ease - 0.15) }
  if (rating === 3) return { interval: 2, ease: r.ease }
  return { interval: 4, ease: clampEase(r.ease + 0.15) }
}

export function schedule(r: ReviewItem, rating: Rating, now = Date.now()): Sched {
  if (rating === 1) {
    return {
      ease: clampEase(r.ease - 0.2),
      interval: 0,
      reps: 0,
      lapses: r.lapses + 1,
      state: r.state === 'new' || r.state === 'learning' ? 'learning' : 'relearning',
      due: now + AGAIN_STEP_MS,
    }
  }

  let interval: number
  let ease: number

  if (r.state === 'new' || r.state === 'learning' || r.state === 'relearning') {
    const g = graduating(r, rating)
    interval = g.interval
    ease = g.ease
    return { ease, interval, reps: 1, lapses: r.lapses, state: 'review', due: now + interval * DAY_MS }
  }

  // continuing review
  const reps = r.reps + 1
  const prev = Math.max(1, r.interval)
  if (rating === 2) {
    ease = clampEase(r.ease - 0.15)
    interval = Math.max(prev + 1, Math.round(prev * 1.2))
  } else if (rating === 3) {
    ease = r.ease
    interval = Math.max(prev + 1, Math.round(prev * r.ease))
  } else {
    ease = clampEase(r.ease + 0.15)
    interval = Math.max(prev + 1, Math.round(prev * r.ease * 1.3))
  }
  return { ease, interval, reps, lapses: r.lapses, state: 'review', due: now + interval * DAY_MS }
}

/** Previews for the four rating buttons, in days (0 = the 10-minute step). */
export function previewIntervals(r: ReviewItem): Record<Rating, number> {
  const p: Record<Rating, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  for (const rating of [1, 2, 3, 4] as Rating[]) {
    p[rating] = schedule(r, rating).interval
  }
  return p
}

export function formatIntervalCompact(days: number): string {
  if (days === 0) return '10m'
  if (days < 31) return `${days}d`
  if (days < 365) return `${Math.round(days / 7)}w`
  const months = days / 30.44
  return months >= 10 ? `${Math.round(months)}mo` : `${months.toFixed(1)}mo`
}

export function formatIntervalLong(days: number): string {
  if (days === 0) return '10 minutes'
  if (days === 1) return '1 day'
  if (days < 31) return `${days} days`
  if (days < 365) return `${Math.round(days / 7)} weeks`
  const months = Math.round(days / 30.44)
  return months === 1 ? '1 month' : `${months} months`
}

export function isDue(r: ReviewItem, now = Date.now()): boolean {
  return !r.suspended && r.due <= now
}

export type Mastery = 'new' | 'learning' | 'young' | 'mature'

export function masteryOf(r: ReviewItem): Mastery {
  if (r.state === 'new') return 'new'
  if (r.state === 'learning' || r.state === 'relearning') return 'learning'
  return r.interval >= 21 ? 'mature' : 'young'
}

export const MASTERY_META: Record<Mastery, { label: string; color: string }> = {
  new: { label: 'New', color: '#9aa08b' },
  learning: { label: 'Learning', color: '#d98e32' },
  young: { label: 'Young', color: '#4f8f7b' },
  mature: { label: 'Mature', color: '#5f8bb0' },
}

export function newReviewItem(itemId: string, now = Date.now()): ReviewItem {
  return {
    id: crypto.randomUUID(),
    itemId,
    ease: 2.5,
    interval: 0,
    reps: 0,
    lapses: 0,
    state: 'new',
    due: now,
    lastReviewed: null,
    suspended: false,
    createdAt: now,
  }
}
