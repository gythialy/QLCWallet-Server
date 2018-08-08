// Copyright (c) 2018 QLC Chain Team
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { logger } from './log';

export default class Timestamp {
  constructor(host, port, user, password, database) {
    this.tableName = 'timestamps';
    this.knex = require('knex')({
      client: 'pg',
      connection: {
        host: host,
        port: port,
        user: user,
        password: password ? password : '',
        database: database
      }
    });

    this.knex.schema
      .hasTable(this.tableName)
      .then(ifExist => {
        if (!ifExist) {
          return this.knex.schema.createTable(this.tableName, table => {
            table.string('hash').notNullable().primary;
            table.timestamp('timestamp');
            logger.info(`table [${this.tableName}] not exist, create it...`);
          });
        } else {
          logger.info(`[${this.tableName}] already exist !!!`);
        }
      })
      .catch(err => {
        logger.error(`create table [${this.tableName}] error, ${err.message}, ${err.stack}`);
      });
  }

  async getTimestamp(hash) {
    return await this.knex(this.tableName)
      .where({
        hash
      })
      .select();
  }

  async getTimestamps(hashes) {
    const returnHashes = {};
    try {
      const dbHashes = await this.knex(this.tableName)
        .whereIn('hash', hashes)
        .select();

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
  async mapAccountHistory(nodeResult) {
    if (!nodeResult || !nodeResult.history) return nodeResult;
    const hashes = nodeResult.history.map(tx => tx.hash);
    const txHashes = await this.getTimestamps(hashes);

    if (txHashes === undefined || Object.keys(txHashes).length == 0) {
      logger.warn('[mapAccountHistory] can not get timestamps of hash %s', hashes);
    } else {
      nodeResult.history = nodeResult.history.map(tx => {
        tx.timestamp = txHashes[tx.hash];
        return tx;
      });
    }

    return nodeResult;
  }

  async mapBlocksInfo(blockHashes, nodeResult) {
    if (!nodeResult || !nodeResult.blocks) return nodeResult;
    const txHashes = await this.getTimestamps(blockHashes);
    if (txHashes === undefined || Object.keys(txHashes).length == 0) {
      logger.warn('[mapBlocksInfo] can not get timestamps of hash %s', blockHashes);
    }

    for (let block in nodeResult.blocks) {
      nodeResult.blocks[block].timestamp = txHashes[block] || null;
    }

    return nodeResult;
  }

  async mapPending(nodeResult) {
    if (!nodeResult || !nodeResult.blocks) return nodeResult;
    const pendingHashes = [];
    for (let block in nodeResult.blocks) {
      pendingHashes.push(block);
    }

    const txHashes = await this.getTimestamps(pendingHashes);
    if (txHashes === undefined || Object.keys(txHashes).length == 0) {
      logger.warn('[mapPending] can not get timestamps of hash %s', txHashes);
    }
    for (let block in nodeResult.blocks) {
      nodeResult.blocks[block].timestamp = txHashes[block] || null;
    }

    return nodeResult;
  }

  async saveHashTimestamp(hash) {
    logger.info(`Saving block timestamp: ${hash}`);
    const knex = this.knex;
    const table = this.tableName;
    await knex(table)
      .select()
      .where('hash', hash)
      .then(rows => {
        if (rows.length === 0) {
          const now = new Date();
          const utcTimestamp = new Date(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            now.getUTCHours(),
            now.getUTCMinutes(),
            now.getUTCSeconds()
          );
          const row = { hash: hash, timestamp: utcTimestamp };
          logger.debug(`generate row: ${JSON.stringify(row)}`);
          return knex
            .insert(row)
            .into(table)
            .then(() => {
              logger.info(`insert timestamp for hash ${hash} into ${table}`);
              return { inserted: true };
            })
            .catch(error => {
              logger.error(`insert timestamp for hash ${hash} error: ${error.message} >>> ${error.stack}`);
            });
        } else {
          logger.warn(`${hash} already exist, ignore`);
          return false;
        }
      })
      .catch(function(err) {
        logger.error(`Error saving hash timestamp:  ${err.message}, ${err.stack}`);
      });
  }
}
