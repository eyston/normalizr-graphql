import { List,Map,Record,Set } from 'immutable';
import { buildClientSchema } from 'graphql/utilities/buildClientSchema';
import { parse as gqlParse } from 'graphql/language/parser';
import { print } from 'graphql/language/printer';
import { validate } from 'graphql/validation/validate';

const Context = Record({
  operation: undefined,
  fragments: undefined,
  types: undefined,
  type: undefined,
  queryTypeName: undefined,
  mutationTypeName: undefined,
  subscriptionTypeName: undefined
});

export const parse = (jsonSchema, string) => {
  let schema = buildClientSchema(jsonSchema.data);
  let document = gqlParse(string, { noLocation: true, noSource: true });
  let errors = validate(schema, document);

  if (errors.length > 0) {
    throw new Error(`errors parsing query string : ${errors.join(', ')}`);
  }

  const context = buildContext(jsonSchema, document);

  const schemaAST = operationSchema(context.operation, context);

  return {
    ast: schemaAST,
    query: print(document)
  };
}

// TODO: make this work on the client schema
const buildContext = (jsonSchema, document) => {
  let {
    queryType,
    mutationType,
    subscriptionType,
    types
  } = jsonSchema.data.__schema;

  // these are null, not undefined, so can't give default destructuring
  mutationType = mutationType || {};
  subscriptionType = subscriptionType || {};

  let {operation,fragments} = document.definitions.reduce(({operation, fragments}, definition) => {
    if (definition.kind === 'OperationDefinition') {
      if (operation) {
        throw new Error('Only a single operation is supported per query');
      } else {
        return {operation: definition, fragments};
      }
    } else if (definition.kind === 'FragmentDefinition') {
      return {operation, fragments: fragments.push(definition)};
    }
  }, { fragments: List() });

  const typeMap = Map(List(types).map(type => [type.name, type]));
  const fragmentMap = Map(fragments.map(fragment => [fragment.name.value, fragment]));

  return Context({
    operation,
    fragments: fragmentMap,
    types: typeMap,
    queryTypeName: queryType.name,
    mutationTypeName: mutationType.name,
    subscriptionTypeName: subscriptionType.name
  });
}

// AST
// *** HERE BE DRAGONS ***
// TODO: holy shit why am I not using the graphql/visitor

const Field = Record({
  parent: undefined,
  key: undefined,
  schema: undefined
});

const EntitySchema = Record({
  kind: 'Entity',
  key: undefined,
  fields: Map()
});

const ObjectSchema = Record({
  kind: 'Object',
  fields: Map()
});

const UnionSchema = Record({
  kind: 'Union',
  schemas: Map()
});

const ArraySchema = Record({
  kind: 'Array',
  schema: undefined
});

const operationSchema = (operation, context) => {
  let type = operationType(operation, context);
  const typeFieldMap = visit(operation.selectionSet, context.set('type', type));

  const dataSchema = buildSchema(type, typeFieldMap, context);

  return ObjectSchema({
    fields: Map({
      data: Field({
        key: 'data',
        schema: dataSchema
      })
    })
  });

  return typeFieldMap;
}


const getName = node => {
  if (node.kind === 'Name') {
    return node.value;
  } else {
    throw new Error(`unknown name node: ${node}`);
  }
}

const isEntity = type => {
  return type.kind === 'OBJECT'
    && List(type.fields).find(field => field.name === 'id');
}

const fieldKey = node => {
  return getName(node.alias || node.name);
}

const assertFieldTypes = (expected, schemas) => {
  const unexpected = Set.fromKeys(schemas).subtract(expected);
  if (!unexpected.isEmpty()) {
    throw new Error(`expected ${expected} types but also got ${unexpected}`);
  }
}

const createObjectSchema = (type, fieldMap) => {
  assertFieldTypes(Set.of(type.name), fieldMap);

  if (isEntity(type)) {
    return EntitySchema({
      key: type.name,
      fields: fieldMap.get(type.name, Map())
    });
  } else {
    return ObjectSchema({
      fields: fieldMap.get(type.name, Map())
    });
  }
}

const createUnionSchema = (type, fieldMap, context) => {
  const possibleTypes = Set(type.possibleTypes.map(type => type.name));
  assertFieldTypes(possibleTypes, fieldMap);

  const schemaTypes = Map(possibleTypes
    .map(type => context.types.get(type))
    .map(type => [type.name, buildSchema(type, Map({[type.name]: fieldMap.get(type.name, List())}))])
  );

  return UnionSchema({
    type: type.name,
    schemas: schemaTypes
  });
}

const createInterfaceSchema = (type, fieldMap, context) => {
  const possibleTypes = Set(type.possibleTypes.map(type => type.name));
  const interfaceType = type.name;
  assertFieldTypes(possibleTypes.add(interfaceType), fieldMap);

  const schemaTypes = Map(possibleTypes
    .map(type => context.types.get(type))
    .map(type => {
      const possibleTypeSchema = fieldMap.get(type.name, List());
      const interfaceSchema = fieldMap.get(interfaceType, List());
      return [type.name, buildSchema(type, Map({[type.name]: possibleTypeSchema.concat(interfaceSchema)}))];
    })
  );

  return UnionSchema({
    type: type.name,
    schemas: schemaTypes
  });
}

// shitty name #1
const buildSchema = (type, fieldMap, context) => {
  switch(type.kind) {
    case 'OBJECT': return createObjectSchema(type, fieldMap, context);
    case 'UNION': return createUnionSchema(type, fieldMap, context);
    case 'INTERFACE': return createInterfaceSchema(type, fieldMap, context);
    default: throw new Error(`unhandled type kind ${type.kind}`);
  }
}

// shitty name #2
const fieldSchema = (type, node, context) => {
  switch(type.kind) {
    case 'NON_NULL': return fieldSchema(type.ofType, node, context);
    case 'LIST': return ArraySchema({ schema: fieldSchema(type.ofType, node, context) });
    case 'SCALAR': return null;
    default:
      let baseType = context.types.get(type.name);
      const fieldMap = visit(node.selectionSet, context.set('type', baseType));
      return buildSchema(baseType, fieldMap, context);
  }
}

const operationType = (node, context) => {
  switch(node.operation) {
    case 'query': return context.types.get(context.queryTypeName);
    case 'mutation': return context.types.get(context.mutationTypeName);
    case 'subscription': return context.types.get(context.subscriptionTypeName);
    default:
      throw new Error(`unhandled node operation ${node.operation}`);
  }
}

const mergeSchema = (prev, next) => {
  if (prev.kind != next.kind) {
    throw new Error(`attempting to merge incompatible schemas : ${prev.kind}, ${next.kind}`);
  }

  if (prev.kind === 'Entity' || prev.kind === 'Object') {
    return prev.update('fields', fields => fields.mergeWith(mergeField, next.fields));
  } else if (prev.kind === 'Union') {
    return prev.update('schemas', schemas => schemas.mergeWith(mergeSchema, next.schemas));
  } else if (prev.kind === 'Array') {
    return prev.update('schema', schema => mergeSchema(schema, next.schema));
  } else {
    throw new Error(`unhandled schema kind ${prev.kind}`);
  }
}

const mergeField = (prev, next) => {
  if (prev.parent != next.parent || prev.key != next.key) {
    throw new Error(`attempting to merge incompatible fields : ${prev.parent}.${prev.key}, ${next.parent}.${next.key}`);
  }

  return prev.update('schema', schema => mergeSchema(schema, next.schema));
}

const mergeFieldMap = (prev, next) => {
  return prev.mergeWith(mergeField, next);
}

const scalarNode = (name) => ({
  kind: 'Field',
  alias: null,
  name: { kind: 'Name', value: name, loc: null },
  arguments: [],
  directives: [],
  selectionSet: null,
  loc: null
});

const visitSelectionSet = (node, context) => {
  if (isEntity(context.type)) {
    node.selections.unshift(scalarNode('id'));
  }

  if (context.type.kind === 'UNION' || context.type.kind === 'INTERFACE') {
    node.selections.unshift(scalarNode('__typename'));
  }

  // typeFieldMap {[string]: {[string]: Field}}
  return List(node.selections)
    .map(node => visit(node, context))
    .reduce((acc, typeFieldMap) => {
      return acc.mergeWith(mergeFieldMap, typeFieldMap)
    }, Map());
}

const visitField = (node, context) => {
  if (getName(node.name).startsWith('__')) {
    return Map();
  }

  let parent = context.type;
  let fieldType = parent.fields.find(f => f.name === node.name.value).type;

  // const field = createField(fieldType, node, context);

  const schema = fieldSchema(fieldType, node, context);

  if (schema) {
    const field = Field({
      parent: parent.name,
      key: fieldKey(node),
      schema: schema
    });
    return Map().setIn([field.parent, field.key], field)
  } else {
    return Map();
  }
}

const visitFragmentSpread = (node, context) => {
  let fragment = context.fragments.get(node.name.value);

  return visitFragment(fragment, context);
}

const visitInlineFragment = (node, context) => {
  return visitFragment(node, context);
}

const visitFragment = (fragment, context) => {
  if (fragment.typeCondition && fragment.typeCondition.kind === 'NamedType') {
    const typeName = getName(fragment.typeCondition.name);
    let type = context.types.get(typeName);
    return visit(fragment.selectionSet, context.set('type', type));
  } else {
    throw new Error(`unhandled fragment -- no typeCondition: ${fragment}`);
  }
}

const visit = (node, context) => {
  switch(node.kind) {
    case 'OperationDefinition': throw new Error(`operation definition found at nested location`);
    case 'SelectionSet': return visitSelectionSet(node, context);
    case 'Field': return visitField(node, context);
    case 'InlineFragment': return visitInlineFragment(node, context);
    case 'FragmentSpread': return visitFragmentSpread(node, context);
    default: throw new Error(`unhandled node kind ${node.kind}`);
  }
}
