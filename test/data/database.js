import {List,Map,Record} from 'immutable';

const Relation = Record({
  friend: undefined
});

const User = Record({
  type: 'User',
  id: undefined,
  name: undefined,
  relations: Relation()
});

const Group = Record({
  type: 'Group',
  id: undefined,
  name: undefined,
  owner: undefined,
  admin: undefined,
  members: List()
});

const CreateUserEvent = Record({
  type: 'CreateUserEvent',
  id: undefined,
  description: undefined,
  initiator: undefined,
  user: undefined
});

const CreateGroupEvent = Record({
  type: 'CreateGroupEvent',
  id: undefined,
  description: undefined,
  initiator: undefined,
  group: undefined
});

let users = Map([
  [1, User({ id: 1, name: 'Huey' })],
  [2, User({ id: 2, name: 'Nate', relations: Relation({friend: 3}) })],
  [3, User({ id: 3, name: 'Junior' })],
  [4, User({ id: 4, name: 'Jason' })],
  [5, User({ id: 5, name: 'Strickland' })],
  [6, User({ id: 6, name: 'Huey' })],
  [7, User({ id: 7, name: 'Comron' })]
]);

let groups = Map([
  [10, Group({ id: 10, name: 'SuperFunClub', owner: 4, admin: 5, members: List.of(1,2) })],
  // [10, Group({ id: 10, name: 'SuperFunClub', owner: 4, admin: 5, members: List.of(1,2,3,4,5,11) })],
  [11, Group({ id: 11, name: 'SecretIdentityClub', owner: 6, admin: 7, members: List.of(6,7) })]
]);

export const getUser = id => users.get(id)

export const getGroup = id => groups.get(id)

export const getMember = id => users.get(id) || groups.get(id)
