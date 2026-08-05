import { IngestionError } from './ingestion.error';

export class XmlParseError extends IngestionError {
  readonly code = 'XML_PARSE_ERROR';

  constructor(public readonly reason: string) {
    const r = reason || 'empty content';
    super(r);
    this.reason = r;
  }
}
