import { applyDecorators } from '@nestjs/common';
import { Matches } from 'class-validator';

/** Validates a calendar date in YYYY-MM-DD form. */
export function IsCalendarDate(): PropertyDecorator {
  return applyDecorators(
    Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '$property must be a date in YYYY-MM-DD format' }),
  );
}
