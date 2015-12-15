import 'babel-polyfill';
import {graphql} from 'graphql';
import {normalize} from 'normalizr';
import chai from 'chai';

import NormalizrQL from '../src/index';
import {querySchema} from '../src/query';
import {schema} from './data/schema';
import jsonSchema from './data/schema.json';

chai.should(); // not really sure wtf this does but yolo

describe('normalizr-graphql', () => {
  it('normalizes a graphql response with the kitchen sink -- plugin', async () => {

    let query = NormalizrQL`
      query {
        group(id: 10) {
          ...groupFields
          members {
            ... on User { name }
            ... on Group { name }
          }
        }
      }

      fragment groupFields on Group {
        name
        admin { name }
        coolKid: admin { name }
      }
    `;
    let response = await graphql(schema, query.string, {});
    let result = normalize(response, query.schema);

    result.should.eql({
      result: {
        data: {
          group: 10
        }
      },
      entities: {
        Group: {
          10: {
            id: 10,
            name: 'SuperFunClub',
            admin: 5,
            coolKid: 5,
            members: [{
              id: 1,
              schema: 'User'
            }, {
              id: 2,
              schema: 'User'
            }]
          }
        },
        User: {
          1: {
            __typename: 'User',
            id: 1,
            name: 'Huey'
          },
          2: {
            __typename: 'User',
            id: 2,
            name: 'Nate'
          },
          5: {
            id: 5,
            name: 'Strickland'
          }
        }
      }
    });
  });
  it('normalizes a graphql response with the kitchen sink -- queryParse', async () => {

    let query = querySchema(jsonSchema, `
      query {
        group(id: 10) {
          ...groupFields
          members {
            ... on User { name }
            ... on Group { name }
          }
        }
      }

      fragment groupFields on Group {
        name
        admin { name }
        coolKid: admin { name }
      }
    `);

    let response = await graphql(schema, query.string, {});
    let result = normalize(response, query.schema);

    result.should.eql({
      result: {
        data: {
          group: 10
        }
      },
      entities: {
        Group: {
          10: {
            id: 10,
            name: 'SuperFunClub',
            admin: 5,
            coolKid: 5,
            members: [{
              id: 1,
              schema: 'User'
            }, {
              id: 2,
              schema: 'User'
            }]
          }
        },
        User: {
          1: {
            __typename: 'User',
            id: 1,
            name: 'Huey'
          },
          2: {
            __typename: 'User',
            id: 2,
            name: 'Nate'
          },
          5: {
            id: 5,
            name: 'Strickland'
          }
        }
      }
    });
  });

});
