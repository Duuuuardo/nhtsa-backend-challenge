import { Injectable } from '@nestjs/common';
import { XMLParser as FastXmlParser, XMLValidator } from 'fast-xml-parser';

@Injectable()
export class XmlParser {
  private readonly parser = new FastXmlParser({
    ignoreAttributes: true,
    trimValues: true,
    parseTagValue: true,
  });

  parse<T>(xml: string): T {
    const normalizedXml = xml.trim();

    if (!normalizedXml) {
      throw new Error('XML content cannot be empty');
    }

    const validationResult = XMLValidator.validate(normalizedXml);

    if (validationResult !== true) {
      throw new Error(`Invalid XML: ${validationResult.err.msg}`);
    }

    return this.parser.parse(normalizedXml) as T;
  }
}
