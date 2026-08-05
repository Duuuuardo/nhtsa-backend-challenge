import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import request from 'supertest';
import type { Server } from 'http';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

jest.setTimeout(30000);

const ALL_MAKES_XML = `<?xml version="1.0" encoding="utf-8"?>
<Response>
  <Count>2</Count>
  <Message>Response returned successfully</Message>
  <SearchCriteria></SearchCriteria>
  <Results>
    <AllVehicleMakes>
      <Make_ID>440</Make_ID>
      <Make_Name>ASTON MARTIN</Make_Name>
    </AllVehicleMakes>
    <AllVehicleMakes>
      <Make_ID>441</Make_ID>
      <Make_Name>TESLA</Make_Name>
    </AllVehicleMakes>
  </Results>
</Response>`;

const VEHICLE_TYPES_440_XML = `<?xml version="1.0" encoding="utf-8"?>
<Response>
  <Count>2</Count>
  <Message>Response returned successfully</Message>
  <SearchCriteria>Make ID: 440</SearchCriteria>
  <Results>
    <VehicleTypesForMakeIds>
      <VehicleTypeId>2</VehicleTypeId>
      <VehicleTypeName>Passenger Car</VehicleTypeName>
    </VehicleTypesForMakeIds>
    <VehicleTypesForMakeIds>
      <VehicleTypeId>7</VehicleTypeId>
      <VehicleTypeName>Multipurpose Passenger Vehicle</VehicleTypeName>
    </VehicleTypesForMakeIds>
  </Results>
</Response>`;

const VEHICLE_TYPES_441_XML = `<?xml version="1.0" encoding="utf-8"?>
<Response>
  <Count>1</Count>
  <Message>Response returned successfully</Message>
  <SearchCriteria>Make ID: 441</SearchCriteria>
  <Results>
    <VehicleTypesForMakeIds>
      <VehicleTypeId>3</VehicleTypeId>
      <VehicleTypeName>Motorcycle</VehicleTypeName>
    </VehicleTypesForMakeIds>
  </Results>
</Response>`;

const INVALID_XML = `<Response><Count>1</Count><Message>Bad XML</Message>`;

type GraphQLError = { extensions?: { code?: string }; message?: string };
type GraphQLResponse<TData = Record<string, unknown>> = {
  data?: TData | null;
  errors?: GraphQLError[];
};

// `app.getHttpServer()` is a Nest internal server object; cast explicitly for supertest.

const graphQL = (app: INestApplication) => {
  const httpServer = app.getHttpServer() as Server;
  return request(httpServer).post('/graphql');
};

const mockHttpService = {
  get: jest.fn(),
};

describe('Ingestion E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HttpService)
      .useValue(mockHttpService)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.$connect();
  });

  beforeEach(async () => {
    mockHttpService.get.mockReset();
    await prisma.makeVehicleType.deleteMany();
    await prisma.make.deleteMany();
    await prisma.vehicleType.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should ingest valid makes and expose them over GraphQL', async () => {
    mockHttpService.get.mockImplementation((url: string) => {
      if (url.includes('getallmakes')) {
        return of({ data: ALL_MAKES_XML });
      }
      if (url.includes('GetVehicleTypesForMakeId/440')) {
        return of({ data: VEHICLE_TYPES_440_XML });
      }
      if (url.includes('GetVehicleTypesForMakeId/441')) {
        return of({ data: VEHICLE_TYPES_441_XML });
      }
      return of({ data: '' });
    });

    const ingestResponse = await graphQL(app)
      .send({
        query: `mutation { ingestNhtsaData { makesProcessed persisted vehicleTypeFetchFailures persistenceFailures stoppedEarly stopReason } }`,
      })
      .expect(200);

    const ingestBody = ingestResponse.body as GraphQLResponse<{
      ingestNhtsaData: {
        makesProcessed: number;
        persisted: number;
        vehicleTypeFetchFailures: number;
        persistenceFailures: number;
        stoppedEarly: null;
        stopReason: null;
      };
    }>;
    expect(ingestBody.errors).toBeUndefined();
    expect(ingestBody.data?.ingestNhtsaData).toEqual({
      makesProcessed: 2,
      persisted: 2,
      vehicleTypeFetchFailures: 0,
      persistenceFailures: 0,
      stoppedEarly: null,
      stopReason: null,
    });

    const listResponse = await graphQL(app)
      .send({
        query: `query { makes(first: 10) { totalCount pageInfo { hasNextPage endCursor } edges { cursor node { makeId makeName vehicleTypes { typeId typeName } } } } }`,
      })
      .expect(200);

    const listBody = listResponse.body as GraphQLResponse<{
      makes: {
        totalCount: number;
        pageInfo: { hasNextPage: boolean; endCursor?: string | null };
        edges: Array<{
          cursor: string;
          node: {
            makeId: number;
            makeName: string;
            vehicleTypes: Array<{ typeId: number; typeName: string }>;
          };
        }>;
      };
    }>;

    expect(listBody.data?.makes.edges.map((e) => e.node)).toEqual([
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
        vehicleTypes: [
          { typeId: 2, typeName: 'Passenger Car' },
          { typeId: 7, typeName: 'Multipurpose Passenger Vehicle' },
        ],
      },
      {
        makeId: 441,
        makeName: 'TESLA',
        vehicleTypes: [{ typeId: 3, typeName: 'Motorcycle' }],
      },
    ]);

    const singleResponse = await graphQL(app)
      .send({
        query: `query { make(makeId: 441) { makeId makeName vehicleTypes { typeId typeName } } }`,
      })
      .expect(200);

    const singleBody = singleResponse.body as GraphQLResponse<{
      make: {
        makeId: number;
        makeName: string;
        vehicleTypes: Array<{ typeId: number; typeName: string }>;
      };
    }>;
    expect(singleBody.data?.make).toEqual({
      makeId: 441,
      makeName: 'TESLA',
      vehicleTypes: [{ typeId: 3, typeName: 'Motorcycle' }],
    });
  });

  it('should persist makes even when one vehicle-types call fails', async () => {
    mockHttpService.get.mockImplementation((url: string) => {
      if (url.includes('getallmakes')) {
        return of({ data: ALL_MAKES_XML });
      }
      if (url.includes('GetVehicleTypesForMakeId/440')) {
        return of({ data: VEHICLE_TYPES_440_XML });
      }
      if (url.includes('GetVehicleTypesForMakeId/441')) {
        return throwError(() => ({
          response: { status: 500 },
          message: 'Server error',
        }));
      }
      return of({ data: '' });
    });

    const ingestResponse = await graphQL(app)
      .send({
        query: `mutation { ingestNhtsaData { makesProcessed persisted vehicleTypeFetchFailures persistenceFailures stoppedEarly stopReason } }`,
      })
      .expect(200);

    const ingestBody = ingestResponse.body as GraphQLResponse<{
      ingestNhtsaData: {
        makesProcessed: number;
        persisted: number;
        vehicleTypeFetchFailures: number;
        persistenceFailures: number;
        stoppedEarly: null;
        stopReason: null;
      };
    }>;
    expect(ingestBody.errors).toBeUndefined();
    expect(ingestBody.data?.ingestNhtsaData).toEqual({
      makesProcessed: 2,
      persisted: 2,
      vehicleTypeFetchFailures: 1,
      persistenceFailures: 0,
      stoppedEarly: null,
      stopReason: null,
    });

    const listResponse = await graphQL(app)
      .send({
        query: `query { make(makeId: 441) { makeId makeName vehicleTypes { typeId typeName } } }`,
      })
      .expect(200);

    const listBody = listResponse.body as GraphQLResponse<{
      make: {
        makeId: number;
        makeName: string;
        vehicleTypes: Array<{ typeId: number; typeName: string }>;
      };
    }>;
    expect(listBody.data?.make).toEqual({
      makeId: 441,
      makeName: 'TESLA',
      vehicleTypes: [],
    });
  });

  it('should return a safe GraphQL error for malformed XML', async () => {
    mockHttpService.get.mockImplementation((url: string) => {
      if (url.includes('getallmakes')) {
        return of({ data: INVALID_XML });
      }
      return of({ data: '' });
    });

    const ingestResponse = await graphQL(app)
      .send({
        query: `mutation { ingestNhtsaData { makesProcessed persisted vehicleTypeFetchFailures persistenceFailures stoppedEarly stopReason } }`,
      })
      .expect(200);

    const ingestBody = ingestResponse.body as GraphQLResponse<null>;
    expect(ingestBody.data).toBeNull();
    expect(ingestBody.errors).toBeDefined();
    expect(ingestBody.errors).toHaveLength(1);
    expect(ingestBody.errors?.[0]?.extensions?.code).toBe('XML_PARSE_ERROR');
    expect(ingestBody.errors?.[0].message).toContain(
      'An internal error occurred while processing ingestion.',
    );
  });
});
