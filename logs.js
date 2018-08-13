// Copyright (c) 2018 QLC Chain Team
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { logger } from './log';
export default class Logs {
  constructor(host, port, user, password, database) {
    this.tableName = 'logs';
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
            table.increments('id');
            table.string('message');
            table.timestamp('timestamp');
            table.string('fileName');
            table.string('lineNumber');
            table.string('level');
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

  async saveLog2Db(log) {
    if (log && log.message) {
        delete log.additional;
        await this.knex
        .insert(log)
        .into(this.tableName)
        .then(() => {
          logger.info(`insert log ${JSON.stringify(log)} into ${this.tableName}`);
          return { inserted: true };
        })
        .catch(error => {
          logger.error(`insert log ${JSON.stringify(log)} error: ${error.message} >>> ${error.stack}`);
        });
    }

    return false;
  }
}
