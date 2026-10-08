import { Controller, Get, Query, HttpStatus } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { QueryPublicAvailabilityDto } from './dto/query-public-availability.dto';

/**
 * Public Controller for Anonymous Blood Availability Board.
 *
 * NOTE: This endpoint is strictly public and read-only.
 * Returns only aggregated, sanitized blood availability metrics.
 * Absolutely no donor, patient, testing, storage, or internal ID data is exposed.
 * GET /api/public/blood-availability
 */
@Controller('public/blood-availability')
export class PublicBloodAvailabilityController {
  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * Retrieves public aggregated blood availability by blood group and component type.
   * GET /api/public/blood-availability
   */
  @Get()
  async getPublicAvailability(@Query() query: QueryPublicAvailabilityDto) {
    const data = await this.inventoryService.getPublicAvailability(query);
    return {
      statusCode: HttpStatus.OK,
      message: 'Public blood availability retrieved successfully',
      data,
    };
  }
}
