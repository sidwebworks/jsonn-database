import Cluster from './lib/database.js';

const cluster = new Cluster();

const database = await cluster.use('public');

const users = await database.collection('users');

const result = users.find();

console.log('result: ', result);
