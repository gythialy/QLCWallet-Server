// Copyright (c) 2018 QLC Chain Team
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

require("dotenv").config();

import express, { json as _json } from "express";
import * as http from "http";
import request from "request-promise-native";
import cors from "cors";
import { promisify } from "util";
import { logger } from "./log";
const { PerformanceObserver, performance } = require('perf_hooks');
const Timestamp = require("./timestamps").default;
const PushServer = require("./wss").default;

/** Configuration **/
const qlcNodeUrl = process.env.QLC_NODE_URL || `http://qlc_node:29735`; // Nano node RPC url
const qlcWorkNodeUrl = process.env.QLC_WORK_NODE_URL || `http://qlc_node:29735`; // Nano work node RPC url
const listeningPort = process.env.APP_PORT || 8888; // Port this app will listen on
const statTime = 10;
const useRedisCache = !!process.env.USE_REDIS || false; // Change this if you are not running a Redis server.  Will use in memory cache instead.
const redisCacheUrl = process.env.REDIS_HOST || `redis`; // Url to the redis server (If used)
const redisCacheTime = 60 * 60 * 24; // Store work for 24 Hours
const memoryCacheLength = 800; // How much work to store in memory (If used)

const obs = new PerformanceObserver((items) => {
  const entry = items.getEntries()[0];
  logger.info(`${entry.name} cost ${entry.duration} ms`);
  performance.clearMarks();
});
obs.observe({ entryTypes: ['measure'] });

let ts = new Timestamp(
  process.env.DB_HOST,
  process.env.DB_PORT,
  process.env.DB_USER,
  process.env.DB_PASS,
  process.env.DB_NAME
);

let loggerstream = {
  write: function (message) {
    logger.info(message);
  }
};

const workCache = [];
let getCache, putCache;

const subscriptionMap = {};

// Statistics reporting?
let tpsCount = 0;

const server = http.createServer(app);
const wss = new PushServer(server, subscriptionMap);
// Set up the webserver
const app = express();
server.on('request', app);

app.use(cors());
app.use(require("morgan")("combined", { stream: loggerstream }));
app.use(_json());
app.use((req, res, next) => {
  if (req.headers["content-type"]) {
    return next();
  }
  req.headers["content-type"] = "application/json";
  next();
});

// Allow certain requests to the Nano RPC and cache work requests
app.post("/", async (req, res) => {
  const allowedActions = [
    "account_history",
    "account_history_topn",
    "account_info",
    "accounts_frontiers",
    "accounts_balances",
    "accounts_pending",
    "block",
    "blocks",
    "block_count",
    "blocks_info",
    "delegators_count",
    "pending",
    "process",
    "representatives_online",
    "validate_account_number",
    "work_generate",
    "tokens"
  ];
  if (!req.body.action || allowedActions.indexOf(req.body.action) === -1) {
    return res.status(500).json({
      error: `Action ${req.body.action} not allowed`
    });
  }

  let workRequest = false;
  let representativeRequest = false;
  let repCacheKey = `online-representatives`;

  // Cache work requests
  if (req.body.action === "work_generate") {
    if (!req.body.hash)
      return res.status(500).json({
        error: `Requires valid hash to perform work`
      });

    const cachedWork = useRedisCache
      ? await getCache(req.body.hash)
      : getCache(req.body.hash); // Only redis is an as operation
    if (cachedWork && cachedWork.length) {
      return res.json({
        work: cachedWork
      });
    }
    workRequest = true;
  }

  // Cache the online representatives request
  if (req.body.action === "representatives_online") {
    const cachedValue = useRedisCache
      ? await getCache(repCacheKey)
      : getCache(repCacheKey); // Only redis is an async operation
    if (cachedValue && cachedValue.length) {
      return res.json(JSON.parse(cachedValue));
    }
    representativeRequest = true;
  }

  performance.mark('A');
  request({
    method: "post",
    uri: workRequest ? qlcWorkNodeUrl : qlcNodeUrl,
    body: req.body,
    json: true,
    timeout: 200000
  })
    .then(async proxyRes => {
      if (proxyRes) {
        if (workRequest && proxyRes.work) {
          putCache(req.body.hash, proxyRes.work);
        }
        if (representativeRequest && proxyRes.representatives) {
          putCache(repCacheKey, JSON.stringify(proxyRes), 5 * 60); // Cache online representatives for 5 minutes
        }
      }

      // Add timestamps to certain requests
      if (req.body.action === "account_history") {
        proxyRes = await ts.mapAccountHistory(proxyRes);
      }
      if (req.body.action === "blocks_info") {
        proxyRes = await ts.mapBlocksInfo(req.body.hashes, proxyRes);
      }
      if (req.body.action === "pending") {
        proxyRes = await ts.mapPending(proxyRes);
      }
      performance.mark('B');
      performance.measure(req.body.action, 'A', 'B');
      res.json(proxyRes);
    })
    .catch(err => {
      performance.mark('C');
      performance.measure(`${req.body.action} error`, 'A', 'C');
      logger.error(`${req.body.action}: ${err.message}`);
      res.status(500).json({ error: err.toString() })
    });
});

app.post("/new-block", async (req, res) => {
  res.sendStatus(200);
  tpsCount++;

  const fullBlock = req.body;
  try {
    logger.info(`receive rpc callback ${fullBlock.hash} of ${fullBlock.block}`);
    fullBlock.block = JSON.parse(fullBlock.block);
    ts.saveHashTimestamp(fullBlock.hash);
  } catch (err) {
    return logger.error(
      `Error parsing block data! ${err.message}, ${err.stack}`
    );
  }

  let destinations = [];

  if (fullBlock.block.type === "state") {
    if (fullBlock.is_send === "true" && fullBlock.block.link_as_account) {
      destinations.push(fullBlock.block.link_as_account);
    }
    destinations.push(fullBlock.account);
  } else {
    destinations.push(fullBlock.block.destination);
  }

  // Send it to all!
  destinations.forEach(destination => {
    if (!subscriptionMap[destination]) return; // Nobody listening for this

    logger.info(
      `Sending block to subscriber ${destination}: ${fullBlock.amount}`
    );

    subscriptionMap[destination].forEach(ws => {
      const event = {
        event: "newTransaction",
        data: fullBlock
      };
      ws.send(JSON.stringify(event));
    });
  });
});

app.get("/health-check", (req, res) => {
  res.sendStatus(200);
});

server.listen(listeningPort, () =>
  logger.info(`QLC Wallet server listening on port ${listeningPort}!`)
);

// Configure the cache functions to work based on if we are using redis or not
if (useRedisCache) {
  const cacheClient = require("redis").createClient({
    host: redisCacheUrl
  });
  cacheClient.on("ready", () => logger.info(`Redis Work Cache: Connected`));
  cacheClient.on("error", err => logger.error(`Redis Work Cache: Error `, err));
  cacheClient.on("end", () =>
    logger.info(`Redis Work Cache: Connection closed`)
  );

  getCache = promisify(cacheClient.get).bind(cacheClient);
  putCache = (hash, work, time) => {
    cacheClient.set(hash, work, "EX", time || redisCacheTime); // Store the work for 24 hours
  };
} else {
  getCache = hash => {
    const existingHash = workCache.find(w => w.hash === hash);
    return existingHash ? existingHash.work : null;
  };
  putCache = (hash, work, time) => {
    if (time) return; // If a specific time is specified, don't cache at all for now
    workCache.push({
      hash,
      work
    });
    if (workCache.length >= memoryCacheLength) {
      workCache.shift(); // If the list is too long, prune it.
    }
  };
}

function printStats() {
  const connectedClients = wss.length();
  const tps = tpsCount / statTime;
  logger.info(
    `[Stats] Connected clients: ${connectedClients}; TPS Average: ${tps}`
  );
  tpsCount = 0;
}

setInterval(printStats, statTime * 1000); // Print stats every x seconds

// const WebSocket = require("ws");

// const ws = new WebSocket(`ws://localhost:${listeningPort}`);

// ws.on("open", function open() {
//   ws.send(
//     JSON.stringify({
//       event: "subscribe",
//       data: ["test_account1", "test_account2"]
//     })
//   );
// });

// ws.on("message", data => console.log(data));
