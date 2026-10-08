'use strict';

const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 3000;

const server = createApp().listen(PORT, '0.0.0.0', () => {
  console.log(`MedFlow sample API listening on port ${PORT}`);
});

// ECS and Docker stop containers by sending SIGTERM. Finish in-flight requests, then exit.
function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
