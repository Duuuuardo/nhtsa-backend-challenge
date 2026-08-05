import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import request from 'supertest';
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

const graphQL = (app: INestApplication) => request(app.getHttpServer()).post('/graphql');

const mockHttpService = {
  get: jest.fn(),
};

describe('Ingestion E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let config: ConfigService;

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
    config = app.get(ConfigService);

    await prisma.$connect();
  });

  beforeEach(async () => {
    mockHttpService.get.mockReset();
    await prisma.vehicleType.deleteMany();
    await prisma.make.deleteMany();
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

    expect(ingestResponse.body.errors).toBeUndefined();
    expect(ingestResponse.body.data.ingestNhtsaData).toEqual({
      makesProcessed: 2,
      persisted: 2,
      vehicleTypeFetchFailures: 0,
      persistenceFailures: 0,
      stoppedEarly: null,
      stopReason: null,
    });

    const listResponse = await graphQL(app)
      .send({ query: `query { makes { makeId makeName vehicleTypes { typeId typeName } } }` })
      .expect(200);

    expect(listResponse.body.data.makes).toEqual([
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
      .send({ query: `query { make(makeId: 441) { makeId makeName vehicleTypes { typeId typeName } } }` })
      .expect(200);

    expect(singleResponse.body.data.make).toEqual({
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
        return throwError(() => ({ response: { status: 500 }, message: 'Server error' }));
      }
      return of({ data: '' });
    });

    const ingestResponse = await graphQL(app)
      .send({
        query: `mutation { ingestNhtsaData { makesProcessed persisted vehicleTypeFetchFailures persistenceFailures stoppedEarly stopReason } }`,
      })
      .expect(200);

    expect(ingestResponse.body.errors).toBeUndefined();
    expect(ingestResponse.body.data.ingestNhtsaData).toEqual({
      makesProcessed: 2,
      persisted: 2,
      vehicleTypeFetchFailures: 1,
      persistenceFailures: 0,
      stoppedEarly: null,
      stopReason: null,
    });

    const listResponse = await graphQL(app)
      .send({ query: `query { make(makeId: 441) { makeId makeName vehicleTypes { typeId typeName } } }` })
      .expect(200);

    expect(listResponse.body.data.make).toEqual({
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

    expect(ingestResponse.body.data).toBeNull();
    expect(ingestResponse.body.errors).toHaveLength(1);
    expect(ingestResponse.body.errors[0].extensions.code).toBe('XML_PARSE_ERROR');
    expect(ingestResponse.body.errors[0].message).toContain('An internal error occurred while processing ingestion.');
  });
});
