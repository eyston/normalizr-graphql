import {normalize,Schema,arrayOf,unionOf} from 'normalizr';

export const transform = ast => {
  switch(ast.kind) {
    case 'Object': return transformObjectSchema(ast);
    case 'Entity': return transformEntitySchema(ast);
    case 'Array': return transformArraySchema(ast);
    case 'Union': return transformUnionSchema(ast);
    default:
      throw new Error(`unhandled ast kind ${ast.kind}`);
  }
}

const transformObjectSchema = ast => {
  return transformFields(ast.fields);
}

const transformEntitySchema = ast => {
  const schema = new Schema(ast.key);
  schema.define(transformFields(ast.fields));
  return schema;
}

const transformArraySchema = ast => {
  return arrayOf(transform(ast.schema));
}

const transformUnionSchema = ast => {
  return unionOf(ast.schemas.map(transform).toObject(), {schemaAttribute: '__typename'});
}

const transformFields = fields => {
  return fields.map(field => transform(field.schema)).toObject();
}
