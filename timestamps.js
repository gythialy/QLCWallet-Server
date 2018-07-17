const db = require('./db');

async function getTimestamp(hash) {
  return await db.knex('timestamps').where({
    hash
  }).select();
}

async function getTimestamps(hashes) {
  const returnHashes = {};
  try {
    const dbHashes = await db.knex('timestamps').whereIn('hash', hashes).select();

    hashes.forEach(hash => {
      const dbResult = dbHashes.find(dbHash => dbHash.hash === hash);
      returnHashes[hash] = dbResult ? dbResult.timestamp : null;
    });

    return returnHashes;
  } catch (err) {
    console.log(`Error retrieving timestamps for `, hashes);
    console.log(err);
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
  console.log(`Saving block timestamp: `, hash);
  const d = new Date();
  try {
    await db.knex('timestamps').insert({
      hash,
      timestamp: d.getTime() + (d.getTimezoneOffset() * 60 * 1000), // Get milliseconds in UTC
    });
  } catch (err) {
    console.log(`Error saving hash timestamp:`, err.message, err);
  }
}

async function createTimestampTable() {
  return db.knex.schema
    .hasTable('timestamps')
    .then(ifExist => {
      if (!ifExist) {
        return db.knex.schema.createTable('timestamps', (table) => {
          table.string('hash').notNullable();
          table.bigInteger('timestamp');
        })
      }
    })
    .catch(err => {
      console.log('create table error !!!', err.message, err.stack)
    });
}

module.exports = {
  getTimestamp,
  getTimestamps,
  mapAccountHistory,
  mapBlocksInfo,
  mapPending,
  saveHashTimestamp,
  createTimestampTable
};