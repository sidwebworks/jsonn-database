import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createOrReadDirectory, existsAsync, isEqual } from './helper.js';

class Cluster {
  constructor(options = { dirname: 'database' }) {
    this.databases = new Map();
    this.dirname = options.dirname;
    this.path = path.join(process.cwd(), this.dirname);
    this.initialized = false;
  }

  async #init() {
    const entries = await createOrReadDirectory(this.path);

    for (const entry of entries) {
      if (entry.isFile()) continue;
      this.databases.set(entry.name, new Database(this, entry.name));
    }
  }

  async use(name) {
    if (!this.initialized) {
      await this.#init();
    }

    const existing = this.databases.get(name);

    if (existing) return existing;

    const database = new Database(this, name);

    await database.init();

    this.databases.set(name, database);

    return database;
  }
}

class Database {
  constructor(cluster, name) {
    this.name = name;
    this.cluster = cluster;
    this.path = path.join(cluster.path, name);
    this.collections = new Map();
    this.flushed = false;

    process.on('exit', () => this.flush(true));
  }

  async init() {
    const entries = await createOrReadDirectory(this.path);
    for (const entry of entries) {
      if (entry.isDirectory()) continue;
      const contents = await readFile(path.resolve(this.path, entry.name), 'utf-8');
      this.collections.set(entry.name, JSON.parse(contents));
    }
  }

  flush(sync = false) {
    if (this.flushed) return;
    this.flushed = true;

    for (const collection of this.collections.values()) {
      if (sync) {
        collection.saveSync();
      } else {
        collection.save().then(() => console.log(`Collection: ${collection.name} saved`));
      }
    }
  }

  async collection(name) {
    const existing = this.collections.get(name);

    if (existing) return existing;

    const collection = new Collection(name, this);

    await collection.init();

    this.collections.set(collection.name, collection);

    return collection;
  }
}

class Collection {
  constructor(name, database) {
    this.name = name;
    this.database = database;
    this.path = path.resolve(database.path, `${name}.json`);
    this.documents = new Map();
  }

  async init() {
    const exists = await existsAsync(this.path, 'file');
    if (exists) {
      const raw = await readFile(this.path, 'utf-8');
      for (const doc of Object.values(JSON.parse(raw))) {
        this.documents.set(doc._id, doc);
      }
    }
  }

  save() {
    const entries = Object.fromEntries(this.documents);
    return writeFile(this.path, JSON.stringify(entries, null, 2), 'utf-8');
  }

  saveSync() {
    const entries = Object.fromEntries(this.documents);
    writeFileSync(this.path, JSON.stringify(entries, null, 2), 'utf-8');
  }

  insert(data) {
    if (this.database.flushed) {
      this.database.flushed = false;
    }

    const id = randomUUID();
    const item = { ...data, _id: id };
    this.documents.set(id, item);
    return item;
  }

  delete(filter) {
    if (this.database.flushed) {
      this.database.flushed = false;
    }

    const matches = this.find(filter);
    const deleted = [];
    for (const doc of matches) {
      this.documents.delete(doc._id);
      deleted.push(doc);
    }

    return deleted;
  }

  find(filter, limit) {
    if (!filter) return [...this.documents.values()];

    const matches = [];

    for (const doc of this.documents.values()) {
      if (matches.length === limit) break;
      if (isEqual(filter, doc)) matches.push(doc);
    }

    return matches;
  }

  findById(id) {
    return this.documents.get(id);
  }

  findUnique(filter) {
    for (const doc of this.documents.values()) {
      if (isEqual(filter, doc)) return doc;
    }
  }
}

export default Cluster;
