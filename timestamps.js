import {
  logger
} from './log';

const knex = require('knex')({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS ? process.env.DB_PASS : '',
    database: process.env.DB_NAME
  }
});

async function getTimestamp(hash) {
  return await knex('timestamps').where({
    hash
  }).select();
}

async function getTimestamps(hashes) {
  const returnHashes = {};
  try {
    const dbHashes = await knex('timestamps').whereIn('hash', hashes).select();

    hashes.forEach(hash => {
      const dbResult = dbHashes.find(dbHash => dbHash.hash === hash);
      returnHashes[hash] = dbResult ? dbResult.timestamp : null;
    });

    return returnHashes;
  } catch (err) {
    logger.error(`Error retrieving timestamps for %s, %s, %s`, hashes, err.message, err.stack);
    return [];
  }
}

/**
 * Morph the normal Nano node responses to include timestamps
 */
async function mapAccountHistory(nodeResult) {
  if (!nodeResult || !nodeResult.history) return nodeResult;
  const hashes = nodeResult.history.map(tx => tx.hash);
  const txHashes = await getTimestamps(hashes);

  nodeResult.history = nodeResult.history.map(tx => {
    tx.timestamp = txHashes[tx.hash];
    return tx;
  });

  return nodeResult;
}

async function mapBlocksInfo(blockHashes, nodeResult) {
  if (!nodeResult || !nodeResult.blocks) return nodeResult;
  const txHashes = await getTimestamps(blockHashes);

  for (let block in nodeResult.blocks) {
    nodeResult.blocks[block].timestamp = txHashes[block] || null;
  }

  return nodeResult;
}

async function mapPending(nodeResult) {
  if (!nodeResult || !nodeResult.blocks) return nodeResult;
  const pendingHashes = [];
  for (let block in nodeResult.blocks) {
    pendingHashes.push(block);
  }

  const txHashes = await getTimestamps(pendingHashes);
  for (let block in nodeResult.blocks) {
    nodeResult.blocks[block].timestamp = txHashes[block] || null;
  }

  return nodeResult;
}

async function saveHashTimestamp(hash) {
  logger.info(`Saving block timestamp: ${hash}`);
  const d = new Date();

  await knex('timestamps').select()
    .where('hash', hash)
    .then(function (rows) {
      if (rows.length === 0) {
        knex('timestamps').insert({
          hash,
          timestamp: d.getTime() + (d.getTimezoneOffset() * 60 * 1000), // Get milliseconds in UTC
        });
      } else {
        logger.info(`${hash} already exist.`);
      }
    })
    .catch(function (err) {
      logger.error(`Error saving hash timestamp: %s, %s`, err.message, err.stack);
    })
}

async function createTimestampTable() {
  return knex.schema
    .hasTable('timestamps')
    .then(ifExist => {
      if (!ifExist) {
        return knex.schema.createTable('timestamps', (table) => {
          table.string('hash').notNullable().primary;
          table.bigInteger('timestamp');
        })
      }
    })
    .catch(err => {
      logger.error('create table error, %s, %s', err.message, err.stack);
    });
}

export {
  getTimestamp,
  getTimestamps,
  mapAccountHistory,
  mapBlocksInfo,
  mapPending,
  saveHashTimestamp,
  createTimestampTable
};