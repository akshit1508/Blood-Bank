import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { CurrencyUtil } from '../utils/currency.util';

export function IsValidInrCurrency(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidInrCurrency',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'number' || isNaN(value) || value < 0.01) {
            return false;
          }
          return CurrencyUtil.hasValidDecimalPrecision(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid positive INR amount with at most two decimal places (minimum ₹0.01). Fractional paise are not permitted.`;
        },
      },
    });
  };
}
