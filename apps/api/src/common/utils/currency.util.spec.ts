import { CurrencyUtil } from './currency.util';
import { BadRequestException } from '@nestjs/common';

describe('CurrencyUtil', () => {
  describe('hasValidDecimalPrecision', () => {
    it('should accept valid integers and 2-decimal numbers', () => {
      expect(CurrencyUtil.hasValidDecimalPrecision(100)).toBe(true);
      expect(CurrencyUtil.hasValidDecimalPrecision(100.5)).toBe(true);
      expect(CurrencyUtil.hasValidDecimalPrecision(100.55)).toBe(true);
      expect(CurrencyUtil.hasValidDecimalPrecision(0.01)).toBe(true);
    });

    it('should reject numbers with more than 2 decimal places', () => {
      expect(CurrencyUtil.hasValidDecimalPrecision(10.005)).toBe(false);
      expect(CurrencyUtil.hasValidDecimalPrecision(10.555)).toBe(false);
      expect(CurrencyUtil.hasValidDecimalPrecision(0.001)).toBe(false);
      expect(CurrencyUtil.hasValidDecimalPrecision(NaN)).toBe(false);
    });
  });

  describe('toPaise', () => {
    it('should correctly convert decimal INR to integer paise', () => {
      expect(CurrencyUtil.toPaise(100)).toBe(10000);
      expect(CurrencyUtil.toPaise(100.5)).toBe(10050);
      expect(CurrencyUtil.toPaise(100.55)).toBe(10055);
      expect(CurrencyUtil.toPaise(0.01)).toBe(1);
    });

    it('should throw BadRequestException on fractional paise without silent rounding', () => {
      expect(() => CurrencyUtil.toPaise(10.005)).toThrow(BadRequestException);
      expect(() => CurrencyUtil.toPaise(10.555)).toThrow(BadRequestException);
    });
  });

  describe('toInr', () => {
    it('should convert integer paise to decimal INR', () => {
      expect(CurrencyUtil.toInr(10000)).toBe(100.0);
      expect(CurrencyUtil.toInr(10050)).toBe(100.5);
      expect(CurrencyUtil.toInr(10055)).toBe(100.55);
      expect(CurrencyUtil.toInr(1)).toBe(0.01);
    });
  });
});
