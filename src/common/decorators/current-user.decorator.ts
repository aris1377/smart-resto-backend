import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // Agar @CurrentUser('id') deb biron-bir maydon so'ralgan bo'lsa, faqat shuni qaytaradi
    return data ? user?.[data] : user;
  },
);
