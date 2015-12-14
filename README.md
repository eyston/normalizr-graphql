# normalizr-graphql

Uses the `normalizr` library to normalize a GraphQL query response.  It is built as a babel-plugin which turns a GraphQL query into an object with a `schema` and `string` property.  The `schema` is a `normalizr` schema which can be passed to `normalize` and the `string` is the query string which may have been modified to add `id` and `__typename` where appropriate.

An example use:

```js

import NormalizeQL from 'normalize-graphql';
import {normalize} from 'normalizr';
import {graphql} from 'graphql';
import schema from './data/schema';

let query = NormalizeQL`{
  query {
    group(id: 1) {
      name
      owner {
        name
      }
      members {
        ...on User {
          name
        }
        ...groupFields
      }
    }
  }

  fragment groupFields on Group {
    name
    owner {
      name
    }
  }
}`;

let response = await graphql(schema, query.string, {});
let result = normalize(response, query.schema);

// result is now normalized with Group and User entities

```
