import { IngestionTransformer } from './ingestion.transformer';

describe('IngestionTransformer', () => {
  let transformer: IngestionTransformer;

  beforeEach(() => {
    transformer = new IngestionTransformer();
  });

  it('should merge makes with vehicle types', () => {
    const makes = [
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
      },
      {
        makeId: 441,
        makeName: 'TESLA',
      },
    ];

    const vehicleTypes = new Map([
      [
        440,
        [
          {
            typeId: 2,
            typeName: 'Passenger Car',
          },
        ],
      ],
      [
        441,
        [
          {
            typeId: 7,
            typeName: 'Truck',
          },
        ],
      ],
    ]);

    expect(transformer.merge(makes, vehicleTypes)).toEqual([
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
        vehicleTypes: [
          {
            typeId: 2,
            typeName: 'Passenger Car',
          },
        ],
      },
      {
        makeId: 441,
        makeName: 'TESLA',
        vehicleTypes: [
          {
            typeId: 7,
            typeName: 'Truck',
          },
        ],
      },
    ]);
  });

  it('should return an empty vehicleTypes array when none exist', () => {
    const makes = [
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
      },
    ];

    const vehicleTypes = new Map();

    expect(transformer.merge(makes, vehicleTypes)).toEqual([
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
        vehicleTypes: [],
      },
    ]);
  });

  it('should return an empty array when no makes are provided', () => {
    expect(transformer.merge([], new Map())).toEqual([]);
  });

  it('should preserve the original order of makes', () => {
    const makes = [
      {
        makeId: 3,
        makeName: 'C',
      },
      {
        makeId: 1,
        makeName: 'A',
      },
      {
        makeId: 2,
        makeName: 'B',
      },
    ];

    const merged = transformer.merge(makes, new Map());

    expect(merged.map((m) => m.makeId)).toEqual([3, 1, 2]);
  });

  it('should not mutate the original makes array', () => {
    const makes = [
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
      },
    ];

    transformer.merge(makes, new Map());

    expect(makes).toEqual([
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
      },
    ]);
  });
});