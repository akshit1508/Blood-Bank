import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

export class CurrencyUtil {
  /**
   * Validates if a number has at most 2 decimal places and no fractional paise.
   * e.g. 10.50 -> true, 10 -> true, 10.005 -> false
   */
  static hasValidDecimalPrecision(value: number): boolean {
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
      return false;
    }
    const strVal = value.toString();
    const parts = strVal.split('.');
    if (parts.length === 2 && parts[1].length > 2) {
      return false;
    }
    return Math.round(value * 100) / 100 === value;
  }

  /**
   * Converts validated decimal INR to exact integer paise (1 INR = 100 paise).
   * Rejects fractional paise upfront (does not silently round).
   */
  static toPaise(inr: number): number {
    if (!this.hasValidDecimalPrecision(inr) || inr < 0) {
      throw new BadRequestException(
        `Invalid monetary value: ₹${inr}. Amounts must be non-negative with at most 2 decimal places. Fractional paise are not permitted.`
      );
    }
    return Math.round(inr * 100);
  }

  /**
   * Converts authoritative integer paise to exact 2-decimal INR.
   */
  static toInr(paise: number): number {
    if (!Number.isInteger(paise) || paise < 0) {
      throw new InternalServerErrorException(
        `Authoritative paise must be a non-negative integer. Received: ${paise}`
      );
    }
    return paise / 100;
  }

  /**
   * Converts authoritative signed integer paise to exact 2-decimal INR (allows negative balances / refunds).
   */
  static toSignedInr(paise: number): number {
    if (!Number.isInteger(paise)) {
      throw new InternalServerErrorException(
        `Authoritative paise must be an integer. Received: ${paise}`
      );
    }
    return paise / 100;
  }

  /**
   * Formats INR for display with standard Indian numbering (e.g., ₹1,50,000.00).
   */
  static formatInr(inr: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(inr);
  }
}
