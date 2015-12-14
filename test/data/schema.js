import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLUnionType,
  GraphQLInterfaceType,
  GraphQLString,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull
} from 'graphql';

import * as db from './database';

const UserType = new GraphQLObjectType({
  name: 'User',
  fields: () => ({
    id: { type: GraphQLInt },
    name: { type: GraphQLString },
    relations: { type: RelationType }
  })
});

const GroupType = new GraphQLObjectType({
  name: 'Group',
  fields: () => ({
    id: { type: GraphQLInt },
    name: { type: GraphQLString },
    owner: { type: MemberType, resolve: g => db.getUser(g.owner) },
    admin: { type: UserType, resolve: g => db.getUser(g.admin) },
    members: { type: new GraphQLList(MemberType), resolve: g => g.members.map(db.getMember).toArray() }
  })
});

const MemberType = new GraphQLUnionType({
  name: 'Member',
  types: [UserType, GroupType],
  // we don't actually execute this schema -- just need schema.json
  resolveType: obj => {
    switch(obj.type) {
      case 'User': return UserType;
      case 'Group': return GroupType;
      default: return null;
    }
  }
});

const RelationType = new GraphQLObjectType({
  name: 'Relation',
  fields: () => ({
    friend: { type: UserType, resolve: r => db.getUser(r.friend) }
  })
});

const EventType = new GraphQLInterfaceType({
  name: 'Event',
  fields: () => ({
    id: { type: GraphQLInt },
    description: { type: GraphQLString },
    initiator: { type: UserType }
  }),
  // we don't actually execute this schema -- just need schema.json
  resolveType: () => null
});

const CreateUserEventType = new GraphQLObjectType({
  name: 'CreateUserEvent',
  fields: () => ({
    id: { type: GraphQLInt },
    description: { type: GraphQLString },
    initiator: { type: UserType },
    user: { type: UserType }
  }),
  interfaces: () => [EventType]
});

const CreateGroupEventType = new GraphQLObjectType({
  name: 'CreateGroupEvent',
  fields: () => ({
    id: { type: GraphQLInt },
    description: { type: GraphQLString },
    initiator: { type: UserType },
    group: { type: GroupType }
  }),
  interfaces: () => [EventType]
});

const QueryType = new GraphQLObjectType({
  name: 'Query',
  fields: () => ({
    group: {
      type: new GraphQLNonNull(GroupType),
      args: {
        id: { type: GraphQLInt }
      },
      resolve: (_, {id}) => db.getGroup(id)
    },
    user: {
      type: UserType,
      args: {
        id: { type: GraphQLInt }
      },
      resolve: (_, {id}) => db.getUser(id)
    },
    event: {
      type: EventType,
      args: {
        id: { type: GraphQLInt }
      }
    }
  })
});

export const schema = new GraphQLSchema({
  query: QueryType
});
