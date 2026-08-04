import Joi from 'joi';

export const vehicleTypesUrlValidator = Joi.string()
  .required()
  .custom((value: string, helpers: any) => {
    if (!value.includes('{makeId}')) {
      return helpers.error('any.invalid');
    }

    try {
      new URL(value.replace('{makeId}', '440'));
      return value;
    } catch {
      return helpers.error('string.uri');
    }
  })
  .messages({
    'any.invalid':
      'NHTSA_VEHICLE_TYPES_BASE_URL must contain the {makeId} placeholder',
    'string.uri':
      'NHTSA_VEHICLE_TYPES_BASE_URL must be a valid URL after replacing {makeId}',
  });
