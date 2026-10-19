import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Request } from 'express';
import { GUEST_SESSION_HEADER } from '../guest.constants';

/**
 * Mijozning anonim sessiya id'si (`X-Guest-Session` sarlavhasi).
 *
 * Brauzer UUID'ni bir marta yaratib `localStorage` da saqlaydi va har
 * so'rovda yuboradi. U shaxsni aniqlamaydi — faqat "shu brauzer shu
 * buyurtmaning egasi" ekanini isbotlaydi.
 *
 * `required: false` — sarlavha bo'lmasa `undefined` qaytadi (menyu sahifasi
 * sessiyasiz ham ochiladi). Lekin yuborilgan bo'lsa, u to'g'ri UUID bo'lishi shart.
 */
export const GuestSession = createParamDecorator(
  (options: { required?: boolean } | undefined, ctx: ExecutionContext) => {
    const required = options?.required ?? true;
    const value = ctx.switchToHttp().getRequest<Request>().headers[
      GUEST_SESSION_HEADER
    ];

    if (value === undefined && !required) {
      return undefined;
    }

    if (typeof value !== 'string' || !isUUID(value, 4)) {
      throw new BadRequestException(
        'X-Guest-Session sarlavhasida UUID v4 boʻlishi kerak.',
      );
    }

    return value.toLowerCase();
  },
);
