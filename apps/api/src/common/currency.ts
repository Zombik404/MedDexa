import { BadRequestException } from '@nestjs/common';
import { SUPPORTED_CURRENCIES } from '@meddexa/shared';

export function resolveCurrency(raw: unknown): string {
  if (raw == null || raw === '') return 'EUR';
  const c = String(raw).toUpperCase();
  if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(c)) {
    throw new BadRequestException({ message: `Unsupported currency ${c}`, code: 'UNSUPPORTED_CURRENCY' });
  }
  return c;
}
