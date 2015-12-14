import {Schema, arrayOf, unionOf} from 'normalizr';

const NormalizrQL = (string, ...args) => {
  throw new Error('this should never run');
}

Object.assign(NormalizrQL, {
  schema(key, definition) {
    const schema = new Schema(key);
    schema.define(definition);
    return schema;
  },
  arrayOf,
  unionOf
});

export default NormalizrQL;
