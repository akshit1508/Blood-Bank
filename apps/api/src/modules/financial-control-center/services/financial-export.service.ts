import { Injectable } from '@nestjs/common';
import { FinancialControlCenterService, FinancialLedgerEntry } from './financial-control-center.service';
import { QueryFinancialLedgerDto } from '../dto/query-financial-ledger.dto';

@Injectable()
export class FinancialExportService {
  constructor(
    private readonly controlCenterService: FinancialControlCenterService,
  ) {}

  /**
   * Sanitizes a string for CSV formula injection mitigation.
   * Prepends a single quote if string starts with dangerous characters.
   */
  private sanitizeCsvCell(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    let str = String(value).trim();
    // Neutralize spreadsheet macro triggers
    if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
      str = `'${str}`;
    }
    // Escape double quotes and enclose in quotes if comma or newline present
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Generates a streaming CSV document of the filtered financial transaction ledger.
   */
  async generateLedgerCsv(dto: QueryFinancialLedgerDto): Promise<{ filename: string; csv: string }> {
    // Override pagination to retrieve complete filtered ledger for export
    const fullDto = { ...dto, page: 1, limit: 10000 };
    const result = await this.controlCenterService.getFinancialLedger(fullDto);

    const headers = [
      'Transaction Date',
      'Reference Code',
      'Transaction Type',
      'Direction',
      'Category / Cost Center',
      'Description',
      'Amount (INR)',
      'Payment Method',
      'Status',
    ];

    const rows: string[] = [headers.map((h) => this.sanitizeCsvCell(h)).join(',')];

    for (const item of result.items) {
      const row = [
        new Date(item.date).toISOString().slice(0, 10),
        item.reference,
        item.typeLabel,
        item.direction,
        item.category,
        item.description,
        item.amountInr.toFixed(2),
        item.paymentMethod || 'N/A',
        item.status,
      ];
      rows.push(row.map((val) => this.sanitizeCsvCell(val)).join(','));
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `Financial_Ledger_Export_${timestamp}.csv`;

    return {
      filename,
      csv: rows.join('\r\n'),
    };
  }
}
