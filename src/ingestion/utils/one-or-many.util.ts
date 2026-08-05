import { OneOrMany } from '../types/nhtsa-response.types';

export function toArray<T>(value: OneOrMany<T>): T[] {
  return Array.isArray(value) ? value : [value];
}
