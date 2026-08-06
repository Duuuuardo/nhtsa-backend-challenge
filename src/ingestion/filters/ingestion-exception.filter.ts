import { Catch, Logger } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { IngestionError } from '../errors';

type ErrorWithCode = Error & { code?: string };

@Catch(Error)
export class IngestionExceptionFilter implements GqlExceptionFilter {
  private readonly logger = new Logger(IngestionExceptionFilter.name);

  catch(exception: unknown) {
    if (exception instanceof IngestionError) {
      this.logger.error({
        event: 'ingestion.error',
        code: exception.code,
        err: exception,
      });

      return new GraphQLError(
        'An internal error occurred while processing ingestion.',
        {
          extensions: { code: exception.code },
        },
      );
    }

    const error =
      exception instanceof Error ? exception : new Error('Unknown error');
    const code = this.getErrorCode(error);
    const safeMessage = this.isUserInputError(error)
      ? error.message
      : 'An internal error occurred.';

    this.logger.error({
      event: 'graphql.error',
      code,
      err: error,
    });

    return new GraphQLError(safeMessage, {
      extensions: { code },
    });
  }

  private getErrorCode(error: ErrorWithCode): string {
    if (typeof error.code === 'string' && error.code.startsWith('P')) {
      return 'INTERNAL_SERVER_ERROR';
    }

    if (typeof error.code === 'string' && error.code.length > 0) {
      return error.code;
    }

    return 'INTERNAL_SERVER_ERROR';
  }

  private isUserInputError(error: ErrorWithCode): boolean {
    return error.message === 'Invalid pagination cursor.';
  }
}
