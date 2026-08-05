import { NhtsaAllMakesXmlResponse } from '../types/nhtsa-response.types';
import { MakeTransformer } from './make.transformer';

describe('MakeTransformer', () => {
  let transformer: MakeTransformer;

  beforeEach(() => {
    transformer = new MakeTransformer();
  });

  it('should transform multiple makes', () => {
    const response: NhtsaAllMakesXmlResponse = {
      Response: {
        Count: 2,
        Message: 'Response returned successfully',
        Results: {
          AllVehicleMakes: [
            {
              Make_ID: 440,
              Make_Name: 'ASTON MARTIN',
            },
            {
              Make_ID: 441,
              Make_Name: 'TESLA',
            },
          ],
        },
      },
    };

    expect(transformer.transform(response)).toEqual([
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
      },
      {
        makeId: 441,
        makeName: 'TESLA',
      },
    ]);
  });

  it('should transform a single make', () => {
    const response: NhtsaAllMakesXmlResponse = {
      Response: {
        Count: 1,
        Message: 'Response returned successfully',
        Results: {
          AllVehicleMakes: {
            Make_ID: 440,
            Make_Name: 'ASTON MARTIN',
          },
        },
      },
    };

    expect(transformer.transform(response)).toEqual([
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
      },
    ]);
  });

  it('should return an empty array when there are no makes', () => {
    const response: NhtsaAllMakesXmlResponse = {
      Response: {
        Count: 0,
        Message: 'Response returned successfully',
        Results: {},
      },
    };

    expect(transformer.transform(response)).toEqual([]);
  });

  it('should trim the make name', () => {
    const response: NhtsaAllMakesXmlResponse = {
      Response: {
        Count: 1,
        Message: 'Response returned successfully',
        Results: {
          AllVehicleMakes: {
            Make_ID: 440,
            Make_Name: '  ASTON MARTIN  ',
          },
        },
      },
    };

    expect(transformer.transform(response)).toEqual([
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
      },
    ]);
  });
});
