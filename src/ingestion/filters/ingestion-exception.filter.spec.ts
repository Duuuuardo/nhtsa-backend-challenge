import { GraphQLError } from 'graphql';

import { IngestionExceptionFilter } from './ingestion-exception.filter';
import { NhtsaRequestError, XmlParseError } from '../errors';

describe('IngestionExceptionFilter', () => {
  let filter: IngestionExceptionFilter;

  beforeEach(() => {
    filter = new IngestionExceptionFilter();
  });

  it('maps NhtsaRequestError to extensions.code NHTSA_REQUEST_FAILED and hides details', () => {
    const err = new NhtsaRequestError({
      operation: 'all makes',
      url: 'https://example.com/all-makes',
      attempts: 1,
      retryable: false,
      status: 502,
      message: 'bad gateway',
    });

    const result = filter.catch(err);

    expect(result).toBeInstanceOf(GraphQLError);
    expect(result.message).toBe(
      'An internal error occurred while processing ingestion.',
    );
    expect(result.extensions).toMatchObject({ code: 'NHTSA_REQUEST_FAILED' });
    expect(result.message).not.toContain('https://');
  });

  it('maps XmlParseError to extensions.code XML_PARSE_ERROR and hides details', () => {
    const err = new XmlParseError('unexpected token');

    const result = filter.catch(err);

    expect(result).toBeInstanceOf(GraphQLError);
    expect(result.message).toBe(
      'An internal error occurred while processing ingestion.',
    );
    expect(result.extensions).toMatchObject({ code: 'XML_PARSE_ERROR' });
  });
});
