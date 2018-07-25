// Copyright (c) 2018 QLCChain Team
// 
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { Server } from "ws";
import { logger } from "./log";

export default class PushServer {
  constructor(port, subscriptionMap) {
    this.subscriptionMap = subscriptionMap;
    this.wss = new Server({
      port: port || 3000,
      perMessageDeflate: {
        zlibDeflateOptions: {
          // See zlib defaults.
          chunkSize: 1024,
          memLevel: 7,
          level: 3
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024
        },
        // Other options settable:
        clientNoContextTakeover: true, // Defaults to negotiated value.
        serverNoContextTakeover: true, // Defaults to negotiated value.
        clientMaxWindowBits: 10, // Defaults to negotiated value.
        serverMaxWindowBits: 10, // Defaults to negotiated value.
        // Below options specified as default values.
        concurrencyLimit: 10, // Limits zlib concurrency for perf.
        threshold: 1024 // Size (in bytes) below which messages
        // should not be compressed.
      }
    });

    let thisObj = this;
    this.wss.on("connection", ws => {
      ws.subscriptions = [];
      logger.info(`WS: - New Connection`);
      ws.isAlive = true;

      ws.on("pong", ws => (ws.isAlive = true));
      ws.on("message", message => {
        try {
          const event = JSON.parse(message);
          thisObj.parseEvent(ws, event);
        } catch (err) {
          logger.error(`WS: Bad message: %s %s`, err.mesage, err.stack);
        }
      });
      ws.on("close", event => {
        logger.info(`WS: - Connection Closed. ${event}`);
        ws.subscriptions.forEach(account => {
          if (!subscriptionMap[account] || !subscriptionMap[account].length)
            return;

          subscriptionMap[account] = subscriptionMap[account].filter(
            subWs => subWs !== ws
          );

          if (subscriptionMap[account].length === 0) {
            delete subscriptionMap[account];
          }
        });
      });
    });

    this.wss.on("error", (ws, err) => {
      logger.err(err);
    });

    // setInterval(() => {
    //   wss.clients.forEach(ws => {
    //     if (ws.isAlive === false) {
    //       return ws.terminate();
    //     }

    //     ws.isAlive = false;
    //     ws.on("ping", () => {});
    //   });
    // }, 30000);
  }

  parseEvent(ws, event) {
    switch (event.event) {
      case "subscribe":
        this.subscribeAccounts(ws, event.data);
        break;
      case "unsubscribe":
        this.unsubscribeAccounts(ws, event.data);
        break;
    }
  }

  subscribeAccounts(ws, accounts) {
    accounts.forEach(account => {
      if (ws.subscriptions.indexOf(account) !== -1) return; // Already subscribed
      ws.subscriptions.push(account);

      // Add into global map
      if (!this.subscriptionMap[account]) {
        this.subscriptionMap[account] = [];
      }

      this.subscriptionMap[account].push(ws);
    });
  }

  unsubscribeAccounts(ws, accounts) {
    accounts.forEach(account => {
      const existingSub = ws.subscriptions.indexOf(account);
      if (existingSub === -1) return; // Not subscribed

      ws.subscriptions.splice(existingSub, 1);

      // Remove from global map
      if (!this.subscriptionMap[account]) return; // Nobody subscribed to this account?

      const globalIndex = this.subscriptionMap[account].indexOf(ws);
      if (globalIndex === -1) {
        logger.info(
          `WS: Subscribe, not found in the global map?  Potential leak? ${account}`
        );
        return;
      }

      this.subscriptionMap[account].splice(globalIndex, 1);
    });
  }

  length() {
    return this.wss.clients.size;
  }
}
