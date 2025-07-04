import { format, formatDistance, formatRelative, isBefore, addDays, addMonths, differenceInDays } from 'date-fns';

/**
 * Format a date in a user-friendly format
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'dd MMM yyyy');
}

/**
 * Format a date with time in a user-friendly format
 */
export function formatDateTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'dd MMM yyyy, HH:mm');
}

/**
 * Calculate days remaining from today to a future date
 * Returns negative value if date is in the past
 */
export function getDaysRemaining(date: Date | string): number {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  return differenceInDays(dateObj, today);
}

/**
 * Format days remaining in a user-friendly way
 */
export function formatDaysRemaining(date: Date | string): string {
  const days = getDaysRemaining(date);
  
  if (days < 0) {
    return `${Math.abs(days)} days overdue`;
  }
  
  if (days === 0) {
    return 'Due today';
  }
  
  return `${days} days left`;
}

/**
 * Check if a date is overdue
 */
export function isOverdue(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of today
  return isBefore(dateObj, today);
}

/**
 * Check if a date is due soon (within next 5 days)
 */
export function isDueSoon(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of today
  const fiveDaysFromNow = addDays(today, 5);
  
  return !isBefore(dateObj, today) && isBefore(dateObj, fiveDaysFromNow);
}

/**
 * Generate payment schedule dates
 */
export function generateScheduleDates(startDate: Date, tenure: number): Date[] {
  const dates: Date[] = [];
  const start = new Date(startDate);
  
  for (let i = 1; i <= tenure; i++) {
    dates.push(addMonths(start, i));
  }
  
  return dates;
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 */
export function getRelativeTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatDistance(dateObj, new Date(), { addSuffix: true });
}
