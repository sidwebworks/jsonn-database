import { Database } from './lib/database.js';

const database = new Database();

const cursor = database.connect('public');

const users = cursor.collection('users');

const result = users.find({ name: 'Greeshma' });

console.log('result: ', result);
// Request comes in
