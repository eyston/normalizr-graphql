import {parse} from './parse';
import {transform} from './transformers/babel';

// export default function (schema) {
const createPlugin = schema => {
  return ({types: t}) => ({
    visitor: {
      TaggedTemplateExpression(path) {
        if (t.isIdentifier(path.node.tag, {name: 'NormalizrQL'})) {
          path.replaceWith(querySchema(schema, t, path));
        }
      }
    }
  });
}

module.exports = createPlugin;

const querySchema = (schema, t, path) => {
  const queryString = processQueryString(path.node.quasi);
  const {ast, query} = parse(schema, queryString);

  return t.objectExpression([
    t.objectProperty(t.stringLiteral('schema'), transform(ast, {t, path})),
    t.objectProperty(t.stringLiteral('string'), t.stringLiteral(query))
  ]);
}

const processQueryString = node => {
  if (node.quasis.length > 1) {
    throw new Error('string interpolation is not currently supported');
  } else {
    return node.quasis[0].value.cooked;
  }
}
