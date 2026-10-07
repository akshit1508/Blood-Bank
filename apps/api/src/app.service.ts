import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealthStatus() {
    return {
      status: 'ok',
      service: 'blood-bank-api',
      phase: 'Phase 0 - Foundation',
      timestamp: new Date().toISOString(),
    };
  }
}
