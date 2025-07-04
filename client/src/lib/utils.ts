import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names with Tailwind's merge utility
 * This allows for conditional class application and prevents
 * conflicting Tailwind classes
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format currency values to Indian Rupee format
 */
export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Format percentage values
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}

/**
 * Calculate EMI (Equated Monthly Installment)
 */
export function calculateEMI(principal: number, rate: number, tenure: number, interestType: string): number {
  let monthlyRate = 0;
  
  // Convert annual rate to monthly rate if needed
  if (interestType === 'annual') {
    monthlyRate = rate / 12 / 100;
  } else if (interestType === 'monthly') {
    monthlyRate = rate / 100;
  } else if (interestType === 'flat') {
    // For flat interest, EMI = (Principal + Total Interest) / Tenure
    const totalInterest = principal * (rate / 100) * (tenure / 12);
    return (principal + totalInterest) / tenure;
  }
  
  // Standard EMI formula: P * r * (1+r)^n / ((1+r)^n - 1)
  const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, tenure) / (Math.pow(1 + monthlyRate, tenure) - 1);
  
  return isNaN(emi) ? 0 : emi;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
