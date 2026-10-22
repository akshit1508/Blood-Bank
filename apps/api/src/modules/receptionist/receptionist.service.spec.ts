import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ReceptionistService } from './receptionist.service';
import { BloodIssue } from '../blood-issues/schemas/blood-issue.schema';
import { BloodIssueInvoice } from '../billing/schemas/blood-issue-invoice.schema';
import { BloodIssueCollection } from '../billing/schemas/blood-issue-collection.schema';
import { BloodRequest } from '../../blood-requests/schemas/blood-request.schema';
import { Inventory } from '../inventory/schemas/inventory.schema';
import { ReceptionistPeriodFilter } from './dto/receptionist-query.dto';

describe('ReceptionistService', () => {
  let service: ReceptionistService;
  let mockBloodIssueModel: any;
  let mockInvoiceModel: any;
  let mockCollectionModel: any;
  let mockBloodRequestModel: any;
  let mockInventoryModel: any;

  const createMockQuery = (resolvedValue: any) => {
    const query: any = {};
    query.sort = jest.fn().mockReturnValue(query);
    query.limit = jest.fn().mockReturnValue(query);
    query.lean = jest.fn().mockReturnValue(query);
    query.exec = jest.fn().mockResolvedValue(resolvedValue);
    query.then = (resolve: any) => Promise.resolve(resolvedValue).then(resolve);
    return query;
  };

  beforeEach(async () => {
    mockBloodIssueModel = {
      find: jest.fn().mockReturnValue(createMockQuery([])),
      findOne: jest.fn().mockReturnValue(createMockQuery(null)),
      findById: jest.fn().mockReturnValue(createMockQuery(null)),
    };

    mockInvoiceModel = {
      find: jest.fn().mockReturnValue(createMockQuery([])),
      findOne: jest.fn().mockReturnValue(createMockQuery(null)),
      findById: jest.fn().mockReturnValue(createMockQuery(null)),
    };

    mockCollectionModel = {
      find: jest.fn().mockReturnValue(createMockQuery([])),
      findOne: jest.fn().mockReturnValue(createMockQuery(null)),
      findById: jest.fn().mockReturnValue(createMockQuery(null)),
    };

    mockBloodRequestModel = {
      find: jest.fn().mockReturnValue(createMockQuery([])),
      findOne: jest.fn().mockReturnValue(createMockQuery(null)),
      findById: jest.fn().mockReturnValue(createMockQuery(null)),
    };

    mockInventoryModel = {
      find: jest.fn().mockReturnValue(createMockQuery([])),
      findOne: jest.fn().mockReturnValue(createMockQuery(null)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceptionistService,
        {
          provide: getModelToken(BloodIssue.name),
          useValue: mockBloodIssueModel,
        },
        {
          provide: getModelToken(BloodIssueInvoice.name),
          useValue: mockInvoiceModel,
        },
        {
          provide: getModelToken(BloodIssueCollection.name),
          useValue: mockCollectionModel,
        },
        {
          provide: getModelToken(BloodRequest.name),
          useValue: mockBloodRequestModel,
        },
        {
          provide: getModelToken(Inventory.name),
          useValue: mockInventoryModel,
        },
      ],
    }).compile();

    service = module.get<ReceptionistService>(ReceptionistService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboardMetrics', () => {
    it('should aggregate metrics and return structured response for today period', async () => {
      mockBloodIssueModel.find.mockReturnValue(
        createMockQuery([
          {
            _id: new Types.ObjectId(),
            issueCode: 'ISS-001',
            bloodGroup: 'O_POSITIVE',
            componentType: 'WHOLE_BLOOD',
            unitsIssued: 2,
            issuedAt: new Date(),
          },
        ]),
      );

      mockInvoiceModel.find.mockReturnValue(
        createMockQuery([
          {
            _id: new Types.ObjectId(),
            invoiceNumber: 'INV-001',
            totalAmount: 3000,
            collectedAmount: 3000,
            status: 'PAID',
            createdAt: new Date(),
          },
        ]),
      );

      mockCollectionModel.find.mockReturnValue(
        createMockQuery([
          {
            _id: new Types.ObjectId(),
            receiptNumber: 'RCP-001',
            paymentMethod: 'CASH',
            amount: 3000,
            collectedAt: new Date(),
          },
        ]),
      );

      const result = await service.getDashboardMetrics({
        period: ReceptionistPeriodFilter.TODAY,
      });

      expect(result).toBeDefined();
      expect(result.summary.totalBloodIssues).toBe(1);
      expect(result.summary.totalUnitsIssued).toBe(2);
      expect(result.summary.totalInvoicesGenerated).toBe(1);
      expect(result.summary.totalPaymentsCollected).toBe(3000);
      expect(result.summary.totalCashCollected).toBe(3000);
      expect(result.summary.totalDigitalCollected).toBe(0);
      expect(result.summary.paymentMethodBreakdown.CASH.amount).toBe(3000);
    });
  });

  describe('searchPatients', () => {
    it('should return aggregated patient profiles grouped by name and phone', async () => {
      mockBloodRequestModel.find.mockReturnValue(
        createMockQuery([
          {
            _id: new Types.ObjectId(),
            requestCode: 'REQ-001',
            patientName: 'Jane Doe',
            patientAge: 29,
            patientGender: 'Female',
            contactPhone: '9876543210',
            hospitalName: 'Apollo Hospital',
            doctorName: 'Dr. Sharma',
            hospitalCaseNumber: 'HOSP-1234',
            bloodGroup: 'B+',
            componentType: 'WHOLE_BLOOD',
            unitsRequested: 1,
            status: 'APPROVED',
            createdAt: new Date(),
          },
        ]),
      );

      const results = await service.searchPatients('Jane');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Jane Doe');
      expect(results[0].phone).toBe('9876543210');
      expect(results[0].totalRequests).toBe(1);
      expect(results[0].recentRequests[0].requestCode).toBe('REQ-001');
    });
  });

  describe('verifyDocuments', () => {
    it('should update verification status and append audit record', async () => {
      const mockSave = jest.fn().mockResolvedValue(true);
      const fakeDoc: any = {
        _id: new Types.ObjectId(),
        requestCode: 'REQ-002',
        documentVerificationStatus: 'PENDING',
        documentVerifiedBy: null,
        documentVerifiedAt: null,
        statusHistory: [],
        save: mockSave,
      };

      mockBloodRequestModel.findById.mockReturnValue(createMockQuery(fakeDoc));

      const updated = await service.verifyDocuments(
        fakeDoc._id.toString(),
        { status: 'VERIFIED', notes: 'Checked ID counter' },
        { id: new Types.ObjectId().toString(), fullName: 'Reception Staff', role: 'FINANCE_RECEPTIONIST' },
      );

      expect(mockSave).toHaveBeenCalled();
      expect(updated.documentVerificationStatus).toBe('VERIFIED');
      expect(updated.documentVerifiedBy).toBe('Reception Staff');
      expect(updated.verifiedByName).toBe('Reception Staff');
      expect(updated.verifiedByRole).toBe('FINANCE_RECEPTIONIST');
      expect(updated.verifiedAt).toBeDefined();
      expect(updated.documentVerifiedAt).toBeDefined();
    });
  });
});
