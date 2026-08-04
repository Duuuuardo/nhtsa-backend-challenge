import {
  NhtsaAllMakesXmlResponse,
  NhtsaVehicleTypesXmlResponse,
} from '../types/nhtsa-xml-response.types';
import { XmlParser } from './xml.parser';

describe('XmlParser', () => {
  let parser: XmlParser;

  beforeEach(() => {
    parser = new XmlParser();
  });

  it('should parse an all-makes XML response', () => {
    const xml = `
      <?xml version="1.0" encoding="utf-8"?>
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
      </Response>
    `;

    const result =
      parser.parse<NhtsaAllMakesXmlResponse>(xml);

    expect(result.Response.Count).toBe(2);
    expect(result.Response.Results.AllVehicleMakes).toEqual([
      {
        Make_ID: 440,
        Make_Name: 'ASTON MARTIN',
      },
      {
        Make_ID: 441,
        Make_Name: 'TESLA',
      },
    ]);
  });

  it('should parse a vehicle-types XML response', () => {
    const xml = `
      <?xml version="1.0" encoding="utf-8"?>
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
      </Response>
    `;

    const result =
      parser.parse<NhtsaVehicleTypesXmlResponse>(xml);

    expect(result.Response.Count).toBe(2);
    expect(
      result.Response.Results.VehicleTypesForMakeIds,
    ).toEqual([
      {
        VehicleTypeId: 2,
        VehicleTypeName: 'Passenger Car',
      },
      {
        VehicleTypeId: 7,
        VehicleTypeName:
          'Multipurpose Passenger Vehicle',
      },
    ]);
  });

  it('should parse a response containing one item', () => {
    const xml = `
      <Response>
        <Count>1</Count>
        <Message>Response returned successfully</Message>
        <SearchCriteria></SearchCriteria>
        <Results>
          <AllVehicleMakes>
            <Make_ID>440</Make_ID>
            <Make_Name>ASTON MARTIN</Make_Name>
          </AllVehicleMakes>
        </Results>
      </Response>
    `;

    const result =
      parser.parse<NhtsaAllMakesXmlResponse>(xml);

    expect(result.Response.Results.AllVehicleMakes).toEqual({
      Make_ID: 440,
      Make_Name: 'ASTON MARTIN',
    });
  });

  it('should parse an empty results element', () => {
    const xml = `
      <Response>
        <Count>0</Count>
        <Message>Response returned successfully</Message>
        <SearchCriteria></SearchCriteria>
        <Results></Results>
      </Response>
    `;

    const result =
      parser.parse<NhtsaAllMakesXmlResponse>(xml);

    expect(result.Response.Count).toBe(0);
    expect(
      result.Response.Results.AllVehicleMakes,
    ).toBeUndefined();
  });

  it('should throw when XML is empty', () => {
    expect(() => parser.parse('   ')).toThrow(
      'XML content cannot be empty',
    );
  });

  it('should throw when XML is invalid', () => {
    const invalidXml = `
      <Response>
        <Results>
      </Response>
    `;

    expect(() => parser.parse(invalidXml)).toThrow(
      'Invalid XML',
    );
  });
});