require('dotenv').config();
import {
  logger
} from './log';
import {
  createTimestampTable,
  mapAccountHistory,
  mapBlocksInfo,
  mapPending,
  saveHashTimestamp
} from './timestamps';
import express, {
  json as _json
} from 'express';
import request from 'request-promise-native';
import cors from 'cors';
import {
  promisify
} from 'util';

createTimestampTable();

/** Configuration **/
const qlcNodeUrl = process.env.QLC_NODE_URL || `http://qlc_node:29735`; // Nano node RPC url
const qlcWorkNodeUrl = process.env.QLC_WORK_NODE_URL || `http://qlc_node:29735`; // Nano work node RPC url
const listeningPort = process.env.APP_PORT || 8888; // Port this app will listen on
const websocketPort = process.env.WEB_SOCKET_PORT || 3333;
const webserverPort = process.env.RPC_CALLBACK_PORT || 8889;
const statTime = 10;
const useRedisCache = !!process.env.USE_REDIS || false; // Change this if you are not running a Redis server.  Will use in memory cache instead.
const redisCacheUrl = process.env.REDIS_HOST || `redis`; // Url to the redis server (If used)
const redisCacheTime = 60 * 60 * 24; // Store work for 24 Hours
const memoryCacheLength = 800; // How much work to store in memory (If used)

const workCache = [];
let getCache, putCache;

// Set up the webserver
const app = express();
app.use(cors());
app.use(express.json());

// Serve the production copy of the wallet
app.use(express.static('static'));
app.get('/*', (req, res) => res.sendFile(`${__dirname}/static/index.html`));

// Allow certain requests to the Nano RPC and cache work requests
app.post('/api/node-api', async (req, res) => {
  const allowedActions = [
    'account_history',
    'account_history_topn',
    'account_info',
    'accounts_frontiers',
    'accounts_balances',
    'accounts_pending',
    'block',
    'blocks',
    'block_count',
    'blocks_info',
    'delegators_count',
    'pending',
    'process',
    'representatives_online',
    'validate_account_number',
    'work_generate',
    'tokens',
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
  if (req.body.action === 'work_generate') {
    if (!req.body.hash) return res.status(500).json({
      error: `Requires valid hash to perform work`
    });

    const cachedWork = useRedisCache ? await getCache(req.body.hash) : getCache(req.body.hash); // Only redis is an async operation
    if (cachedWork && cachedWork.length) {
      return res.json({
        work: cachedWork
      });
    }
    workRequest = true;
  }

  // Cache the online representatives request
  if (req.body.action === 'representatives_online') {
    const cachedValue = useRedisCache ? await getCache(repCacheKey) : getCache(repCacheKey); // Only redis is an async operation
    if (cachedValue && cachedValue.length) {
      return res.json(JSON.parse(cachedValue));
    }
    representativeRequest = true;
  }

  // Send the request to the Nano node and return the response
  request({
      method: 'post',
      uri: (workRequest || representativeRequest) ? qlcWorkNodeUrl : qlcNodeUrl,
      body: req.body,
      json: true
    })
    .then(async (proxyRes) => {
      if (proxyRes) {
        if (workRequest && proxyRes.work) {
          putCache(req.body.hash, proxyRes.work);
        }
        if (representativeRequest && proxyRes.representatives) {
          putCache(repCacheKey, JSON.stringify(proxyRes), 5 * 60); // Cache online representatives for 5 minutes
        }
      }

      // Add timestamps to certain requests
      if (req.body.action === 'account_history') {
        proxyRes = await mapAccountHistory(proxyRes);
      }
      if (req.body.action === 'blocks_info') {
        proxyRes = await mapBlocksInfo(req.body.hashes, proxyRes);
      }
      if (req.body.action === 'pending') {
        proxyRes = await mapPending(proxyRes);
      }
      res.json(proxyRes)
    })
    .catch(err => res.status(500).json(err.toString()));
});

app.listen(listeningPort, () => logger.info(`QLC Wallet server listening on port ${listeningPort}!`));

// Configure the cache functions to work based on if we are using redis or not
if (useRedisCache) {
  const cacheClient = require('redis').createClient({
    host: redisCacheUrl,
  });
  cacheClient.on('ready', () => logger.info(`Redis Work Cache: Connected`));
  cacheClient.on('error', (err) => logger.error(`Redis Work Cache: Error `, err));
  cacheClient.on('end', () => logger.info(`Redis Work Cache: Connection closed`));

  getCache = promisify(cacheClient.get).bind(cacheClient);
  putCache = (hash, work, time) => {
    cacheClient.set(hash, work, 'EX', time || redisCacheTime); // Store the work for 24 hours
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

const subscriptionMap = {};

// Statistics reporting?
let tpsCount = 0;
const rcp_callback_app = express();
rcp_callback_app.use((req, res, next) => {
  if (req.headers['content-type']) return next();
  req.headers['content-type'] = 'application/json';
  next();
});
rcp_callback_app.use(_json());
rcp_callback_app.post('/api/new-block', (req, res) => {
  res.sendStatus(200);
  tpsCount++;

  const fullBlock = req.body;
  try {
    // TODO: refine 
    //fullBlock.block = JSON.parse(fullBlock.block);
    saveHashTimestamp(fullBlock.hash);
  } catch (err) {
    return logger.error(`Error parsing block data! %s`, err.message);
  }

  let destinations = [];

  if (fullBlock.block.type === 'state') {
    if (fullBlock.is_send === 'true' && fullBlock.block.link_as_account) {
      destinations.push(fullBlock.block.link_as_account);
    }
    destinations.push(fullBlock.account);
  } else {
    destinations.push(fullBlock.block.destination);
  }

  // Send it to all!
  destinations.forEach(destination => {
    if (!subscriptionMap[destination]) return; // Nobody listening for this

    logger.info(`Sending block to subscriber ${destination}: `, fullBlock.amount);

    subscriptionMap[destination].forEach(ws => {
      const event = {
        event: 'newTransaction',
        data: fullBlock
      };
      ws.send(JSON.stringify(event));
    });
  });
});

rcp_callback_app.get('/health-check', (req, res) => {
  res.sendStatus(200);
});

rcp_callback_app.listen(webserverPort, () => logger.info(`QLCChain RPC callback server listening on port ${webserverPort}!`));

import {
  Server as WebSocketServer
} from 'uws';
const wss = new WebSocketServer({
  port: websocketPort
});

wss.on('connection', function (ws) {
  ws.subscriptions = [];
  logger.info(`WS: - New Connection`);
  ws.on('message', message => {
    try {
      const event = JSON.parse(message);
      parseEvent(ws, event);
    } catch (err) {
      logger.error(`WS: Bad message: `, err);
    }
  });
  ws.on('close', event => {
    logger.info(`WS: - Connection Closed`);
    ws.subscriptions.forEach(account => {
      if (!subscriptionMap[account] || !subscriptionMap[account].length) return; // Not in there for some reason?

      subscriptionMap[account] = subscriptionMap[account].filter(subWs => subWs !== ws);

      if (subscriptionMap[account].length === 0) {
        delete subscriptionMap[account];
      }
    });
  });
});

function parseEvent(ws, event) {
  switch (event.event) {
    case 'subscribe':
      subscribeAccounts(ws, event.data);
      break;
    case 'unsubscribe':
      unsubscribeAccounts(ws, event.data);
      break;
  }
}

function subscribeAccounts(ws, accounts) {
  accounts.forEach(account => {
    if (ws.subscriptions.indexOf(account) !== -1) return; // Already subscribed
    ws.subscriptions.push(account);

    // Add into global map
    if (!subscriptionMap[account]) {
      subscriptionMap[account] = [];
    }

    subscriptionMap[account].push(ws);
  });
}

function unsubscribeAccounts(ws, accounts) {
  accounts.forEach(account => {
    const existingSub = ws.subscriptions.indexOf(account);
    if (existingSub === -1) return; // Not subscribed

    ws.subscriptions.splice(existingSub, 1);

    // Remove from global map
    if (!subscriptionMap[account]) return; // Nobody subscribed to this account?

    const globalIndex = subscriptionMap[account].indexOf(ws);
    if (globalIndex === -1) {
      logger.info(`WS: Subscribe, not found in the global map?  Potential leak? ${account}`);
      return;
    }

    subscriptionMap[account].splice(globalIndex, 1);
  });
}

function printStats() {
  const connectedClients = wss.clients.length;
  const tps = tpsCount / statTime;
  logger.info(`[Stats] Connected clients: ${connectedClients}; TPS Average: ${tps}`);
  tpsCount = 0;
}

setInterval(printStats, statTime * 1000); // Print stats every x seconds

logger.info(`QLC wallet websocket server listening on port ${websocketPort}!`);