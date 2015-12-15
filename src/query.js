import {parse} from './parse';
import {transform} from './transformers/normalizr';

export const querySchema = (schema, query) => {
  const {ast, query: updatedQuery} = parse(schema, query);

  return {
    schema: transform(ast),
    string: updatedQuery
  }
}
