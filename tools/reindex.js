/* eslint-disable no-console */

'use strict';

const Promise = require('bluebird');
const assert = require('assert');
const client = require('../config').elasticsearch;
const indexers = require('./indexers');


function runIndexer(indexDefinition, alias, indexer) {
  const index = uniqueIndexName(alias);
  const mapping = Object.assign(
    {},
    indexDefinition,
    { index }
  );

  return Promise.resolve()
    .then(() => client.indices.create(mapping))
    .then(() => indexer(index))
    .catch((err) => removeIndexes([index]).then(() => { throw err; }))
    .then(() => updateAlias(index, alias))
    .catch((err) => {
      console.error(err);
      process.exit(-1);
    });
}

function uniqueIndexName(alias) {
  const date = new Date();
  const indexSuffix = `${date.toISOString().slice(0, 10)}_${date.getTime()}`;
  return `${alias}_${indexSuffix}`;
}

function updateAlias(index, alias) {
  let indexesToRemove;

  return Promise.resolve()
    .then(() => client.indices.getAlias({ name: alias }))
    .catch(ignoreESError(404))
    .then((oldAliases) => {
      if (oldAliases) {
        indexesToRemove = Object.keys(oldAliases);
      }
    })
    .then(() => client.indices.updateAliases({
      body: {
        actions: [
          { remove: { index: '*', alias } },
          { add: { index, alias } },
        ],
      },
    }))
    .then(() => removeIndexes(indexesToRemove));
}

function ignoreESError(statusCode) {
  return (err) => {
    if (err.status !== statusCode) {
      throw err;
    }
  };
}

function removeIndexes(indexes) {
  let result;

  if (indexes) {
    console.log('Removing indexes:', indexes.join(', '));
    result = client.indices.delete({ index: indexes, ignore: 404 });
  }

  return result;
}

function indexersToRun() {
  const argv = process.argv;
  const knownIndexers = Object.keys(indexers);
  let result = knownIndexers;

  if (argv.length > 2) {
    const potentialIndexers = argv.slice(2);

    const unknownIndexers = potentialIndexers.filter((idx) => knownIndexers.indexOf(idx) === -1);
    const msg = `Unknown indexers: ${unknownIndexers.join(', ')}. Valid indexers are: ${knownIndexers.join(', ')}.`;
    assert.deepEqual(unknownIndexers.length, 0, msg);

    result = potentialIndexers;
  }

  return result;
}

Promise.each(indexersToRun(), (key) => {
  const indexer = indexers[key];
  return runIndexer(
    indexer.index,
    indexer.alias,
    indexer.indexer
  );
})
.then(() => process.exit());
