import Cluster from './lib/database.js';

const cluster = new Cluster();

const database = await cluster.use('public');

const users = await database.collection('users');

users.insert({
  name: 'Sidharth',
  age: 18,
});

const result = users.find();

console.log(users);

console.log('result: ', result);
