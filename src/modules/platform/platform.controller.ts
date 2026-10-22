import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreatePlanDto,
  CreateSubscriptionDto,
  CreateTenantDto,
  ListInvoicesDto,
  ListTenantsDto,
  MonthlyStatsDto,
  UpdatePlanDto,
  UpdateTenantDto,
  UpdateTenantStatusDto,
} from './dto';
import { PlanService } from './plan.service';
import { PlatformService } from './platform.service';
import { SubscriptionService } from './subscription.service';

/**
 * C qatlam — faqat platforma egasi uchun.
 * Klass darajasidagi @Roles ichidagi barcha endpointlarga tarqaladi.
 */
@ApiBearerAuth()
@Roles(Role.SUPER_ADMIN)
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly platformService: PlatformService,
    private readonly subscriptionService: SubscriptionService,
    private readonly planService: PlanService,
  ) {}

  @Get('tenants')
  listTenants(@Query() query: ListTenantsDto) {
    return this.platformService.listTenants(query);
  }

  @Get('tenants/:id')
  getTenant(@Param('id', ParseIntPipe) id: number) {
    return this.platformService.getTenant(id);
  }

  @Post('tenants')
  async createTenant(@Body() dto: CreateTenantDto) {
    return {
      message: 'Restoran yaratildi.',
      data: await this.platformService.createTenant(dto),
    };
  }

  @Patch('tenants/:id')
  async updateTenant(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTenantDto,
  ) {
    return {
      message: 'Restoran yangilandi.',
      data: await this.platformService.updateTenant(id, dto),
    };
  }

  @Patch('tenants/:id/status')
  async setTenantStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTenantStatusDto,
  ) {
    return {
      message: dto.isActive
        ? 'Restoran faollashtirildi.'
        : 'Restoran bloklandi.',
      data: await this.platformService.setTenantStatus(id, dto),
    };
  }

  @Post('tenants/:id/subscription')
  async grantSubscription(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return {
      message: 'Obuna berildi.',
      data: await this.subscriptionService.grant(id, dto),
    };
  }

  @Get('plans')
  listPlans() {
    return this.planService.findAll();
  }

  @Post('plans')
  async createPlan(@Body() dto: CreatePlanDto) {
    return {
      message: 'Tarif yaratildi.',
      data: await this.planService.create(dto),
    };
  }

  @Patch('plans/:id')
  async updatePlan(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlanDto,
  ) {
    return {
      message: 'Tarif yangilandi.',
      data: await this.planService.update(id, dto),
    };
  }

  /** Yon menyudagi "Hisob-fakturalar" bo'limi */
  @Get('invoices')
  listInvoices(@Query() query: ListInvoicesDto) {
    return this.platformService.listInvoices(query);
  }

  @Get('stats')
  getStats() {
    return this.platformService.getStats();
  }

  /** Statistika ekranidagi grafiklar — oylik tushum va restoranlar oʻsishi */
  @Get('stats/monthly')
  getMonthlyStats(@Query() query: MonthlyStatsDto) {
    return this.platformService.getMonthlyStats(query);
  }
}
