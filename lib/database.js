import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isEqual } from './helper.js';

export class Database {
  constructor(options = { dirname: 'data' }) {
    this.clusters = new Map();
    this.dirname = options.dirname;
    this.path = path.join(process.cwd(), this.dirname);

    if (existsSync(this.path)) {
      const entries = readdirSync(this.path, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) continue;
        this.clusters.set(entry.name, new Cluster(this, entry.name));
      }
    } else {
      mkdirSync(this.path);
    }
  }

  connect(clusterName) {
    const existing = this.clusters.get(clusterName);

    if (existing) {
      return existing;
    }

    const cluster = new Cluster(this, clusterName);

    this.clusters.set(clusterName, cluster);

    return cluster;
  }
}

export class Cluster {
  constructor(database, name) {
    this.name = name;
    this.database = database;
    this.path = path.join(database.path, name);
    this.collections = new Map();
    this.flushed = false;

    if (existsSync(this.path)) {
      const entries = readdirSync(this.path, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) continue;
        const contents = readFileSync(path.resolve(this.path, entry.name), 'utf-8');
        this.collections.set(entry.name, JSON.parse(contents));
      }
    } else {
      mkdirSync(this.path);
    }

    process.on('exit', () => this.flush(true));
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

  collection(name) {
    const existing = this.collections.get(name);

    if (existing) return existing;

    const collection = new Collection(name, this);

    this.collections.set(collection.name, collection);

    return collection;
  }
}

class Collection {
  constructor(name, cluster) {
    this.name = name;
    this.cluster = cluster;
    this.path = path.resolve(cluster.path, `${name}.json`);
    this.documents = new Map();

    if (existsSync(this.path)) {
      const raw = readFileSync(this.path, 'utf-8');
      const parsed = JSON.parse(raw);
      for (const doc of Object.values(parsed)) {
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
    const id = randomUUID();
    const item = { ...data, _id: id };
    this.documents.set(id, item);
    return item;
  }

  delete(filter) {
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
