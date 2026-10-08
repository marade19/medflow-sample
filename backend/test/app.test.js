'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');

let server;
let base;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

const post = (path, body) =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

test('health check answers ok', async () => {
  const res = await fetch(base + '/health');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('a new ticket holds metadata only and has a random ID', async () => {
  const res = await post('/api/tickets', { facility_id: 'HOSP_TEST_01', department: 'General Medicine' });
  assert.equal(res.status, 201);
  const ticket = await res.json();
  assert.match(ticket.ticket_id, /^TCK-[0-9A-F]{8}$/);
  assert.equal(ticket.status, 'WAITING');
  assert.deepEqual(Object.keys(ticket).sort(), [
    'arrival_time',
    'assigned_room',
    'department',
    'eta_minutes',
    'facility_id',
    'patients_ahead',
    'status',
    'ticket_id',
  ]);
});

test('bad input is rejected', async () => {
  const badDept = await post('/api/tickets', { facility_id: 'HOSP_TEST_02', department: 'Astrology' });
  assert.equal(badDept.status, 400);
  const badFacility = await post('/api/tickets', { facility_id: 'x', department: 'Pharmacy' });
  assert.equal(badFacility.status, 400);
});

test('call-next serves patients first in, first out', async () => {
  const body = { facility_id: 'HOSP_TEST_03', department: 'Pediatrics' };
  const first = await (await post('/api/tickets', body)).json();
  const second = await (await post('/api/tickets', body)).json();
  assert.equal(second.patients_ahead, 1);
  assert.equal(second.eta_minutes, 8);

  const called1 = await (await post('/api/queue/call-next', { ...body, room: 'Room 3' })).json();
  assert.equal(called1.ticket_id, first.ticket_id);
  assert.equal(called1.status, 'IN_PROGRESS');
  assert.equal(called1.assigned_room, 'Room 3');

  const called2 = await (await post('/api/queue/call-next', body)).json();
  assert.equal(called2.ticket_id, second.ticket_id);

  const empty = await post('/api/queue/call-next', body);
  assert.equal(empty.status, 404);
});

test('hospitals cannot see or call each other\'s patients', async () => {
  await post('/api/tickets', { facility_id: 'HOSP_AAA_01', department: 'Laboratory' });

  const listB = await (await fetch(base + '/api/tickets?facility_id=HOSP_BBB_01')).json();
  assert.equal(listB.length, 0);

  const callB = await post('/api/queue/call-next', { facility_id: 'HOSP_BBB_01', department: 'Laboratory' });
  assert.equal(callB.status, 404);
});
