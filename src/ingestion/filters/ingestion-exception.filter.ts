import { Catch, Logger } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { IngestionError } from '../errors';

@Catch(IngestionError)
export class IngestionExceptionFilter implements GqlExceptionFilter {
  private readonly logger = new Logger(IngestionExceptionFilter.name);

  catch(exception: IngestionError) {
    this.logger.error({
      event: 'ingestion.error',
      code: exception.code,
      err: exception,
    });

    const safeMessage =
      'An internal error occurred while processing ingestion.';
    return new GraphQLError(safeMessage, {
      extensions: { code: exception.code },
    });
  }
}
