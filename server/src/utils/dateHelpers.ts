import { differenceInDays, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { env } from '../config/env.js';

export enum DocumentStatus {
  ACTIVE = 'ACTIVE',
  UPCOMING = 'UPCOMING',
  DUE_SOON = 'DUE_SOON',
  CRITICAL = 'CRITICAL',
  EXPIRES_TODAY = 'EXPIRES_TODAY',
  EXPIRED = 'EXPIRED',
  RENEWED = 'RENEWED',
  CANCELLED = 'CANCELLED',
}

const TIMEZONE = env?.TIMEZONE || 'Asia/Kolkata';

/**
 * Gets the current date in Asia/Kolkata timezone, at the start of day.
 */
export function getTodayIST(): Date {
  const now = new Date();
  const zonedNow = toZonedTime(now, TIMEZONE);
  return startOfDay(zonedNow);
}

/**
 * Returns the number of days remaining until expiry.
 * Uses Asia/Kolkata timezone for all calculations.
 * Negative values indicate the document has already expired.
 */
export function getDaysRemaining(endDate: Date): number {
  const today = getTodayIST();
  const expiry = startOfDay(new Date(endDate));
  return differenceInDays(expiry, today);
}

/**
 * Calculates the status of a document based on its end date relative to today (IST).
 *
 * - EXPIRED: endDate < today
 * - EXPIRES_TODAY: endDate === today
 * - CRITICAL: 1-7 days remaining
 * - DUE_SOON: 8-15 days remaining
 * - UPCOMING: 16-30 days remaining
 * - ACTIVE: more than 30 days remaining
 */
export function calculateDocumentStatus(endDate: Date): DocumentStatus {
  const daysRemaining = getDaysRemaining(endDate);

  if (daysRemaining < 0) {
    return DocumentStatus.EXPIRED;
  }

  if (daysRemaining === 0) {
    return DocumentStatus.EXPIRES_TODAY;
  }

  if (daysRemaining <= 7) {
    return DocumentStatus.CRITICAL;
  }

  if (daysRemaining <= 15) {
    return DocumentStatus.DUE_SOON;
  }

  if (daysRemaining <= 30) {
    return DocumentStatus.UPCOMING;
  }

  return DocumentStatus.ACTIVE;
}

/**
 * Checks if a document needs a 15-day reminder.
 * Returns true if days remaining is exactly 15.
 */
export function needs15DayReminder(endDate: Date): boolean {
  return getDaysRemaining(endDate) === 15;
}

/**
 * Checks if a document needs a 7-day daily reminder.
 * Returns true if days remaining is between 1 and 7 (inclusive) or 0 (expiry day).
 */
export function needsDailyReminder(endDate: Date): boolean {
  const days = getDaysRemaining(endDate);
  return days >= 0 && days <= 7;
}

/**
 * Gets the reminder type based on days remaining.
 */
export function getReminderType(daysRemaining: number): string | null {
  if (daysRemaining === 15) return 'FIFTEEN_DAY';
  if (daysRemaining === 7) return 'SEVEN_DAY_7';
  if (daysRemaining === 6) return 'SEVEN_DAY_6';
  if (daysRemaining === 5) return 'SEVEN_DAY_5';
  if (daysRemaining === 4) return 'SEVEN_DAY_4';
  if (daysRemaining === 3) return 'SEVEN_DAY_3';
  if (daysRemaining === 2) return 'SEVEN_DAY_2';
  if (daysRemaining === 1) return 'SEVEN_DAY_1';
  if (daysRemaining === 0) return 'EXPIRY_DAY';
  return null;
}

/**
 * Formats a date for display in en-IN locale.
 */
export function formatDateIN(date: Date): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
