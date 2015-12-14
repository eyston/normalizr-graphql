
export const transform = (ast, context) => {
  switch(ast.kind) {
    case 'Object': return transformObjectSchema(ast, context);
    case 'Entity': return transformEntitySchema(ast, context);
    case 'Array': return transformArraySchema(ast, context);
    case 'Union': return transformUnionSchema(ast, context);
    default:
      throw new Error(`unhandled ast kind ${ast.kind}`);
  }
}

const transformObjectSchema = (ast, context) => {
  return transformFields(ast.fields, context);
}

const transformEntitySchema = (ast, context) => {
  let {t,path} = context;

  return t.callExpression(
    t.memberExpression(path.node.tag, t.identifier('schema')),
    [t.stringLiteral(ast.key), transformFields(ast.fields, context)]
  );
}

const transformArraySchema = (ast, context) => {
  let {t,path} = context;

  return t.callExpression(
    t.memberExpression(path.node.tag, t.identifier('arrayOf')),
    [transform(ast.schema, context)]
  );
}

const transformUnionSchema = (ast, context) => {
  let {t,path} = context;

  return t.callExpression(
    t.memberExpression(path.node.tag, t.identifier('unionOf')),
    [
      t.objectExpression(ast.schemas.entrySeq().map(([key, schema]) => {
        return t.objectProperty(
          t.identifier(key),
          transform(schema, context)
        );
      }).toArray()),
      t.objectExpression([
        t.objectProperty(
          t.identifier('schemaAttribute'),
          t.stringLiteral('__typename')
        )
      ])
    ]
  );
}

const transformFields = (fields, context) => {
  let {t} = context;

  return t.objectExpression(fields.valueSeq().map(field => {
    return t.objectProperty(
      t.identifier(field.key),
      transform(field.schema, context)
    );
  }).toArray());
}
