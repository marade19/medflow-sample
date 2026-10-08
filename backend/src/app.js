'use strict';

const express = require('express');
const crypto = require('crypto');

const DEPARTMENTS = ['General Medicine', 'Pediatrics', 'Laboratory', 'Pharmacy'];
const FACILITY_PATTERN = /^[A-Z0-9_]{3,32}$/;
const MINUTES_PER_PATIENT = 8; // simple ETA rule for the sample

// Random, non-sequential ticket IDs (the PRD forbids guessable ones like #A-41)
function newTicketId(tickets) {
  let id;
  do {
    id = 'TCK-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  } while (tickets.some((t) => t.ticket_id === id));
  return id;
}

const isFacility = (v) => typeof v === 'string' && FACILITY_PATTERN.test(v);

function createApp() {
  const app = express();
  app.use(express.json({ limit: '10kb' }));

  // In-memory store. The real project swaps this for PostgreSQL (RDS).
  // Notice: metadata only. No names, no phone numbers, no medical details.
  const tickets = [];

  // Every lookup filters by facility_id: a tiny demo of multi-tenant isolation.
  const waitingIn = (facility, department) =>
    tickets.filter(
      (t) => t.facility_id === facility && t.department === department && t.status === 'WAITING'
    ); // array order = arrival order = first in, first out

  const present = (ticket) => {
    if (ticket.status !== 'WAITING') {
      return { ...ticket, patients_ahead: null, eta_minutes: null };
    }
    const queue = waitingIn(ticket.facility_id, ticket.department);
    const ahead = queue.findIndex((t) => t.ticket_id === ticket.ticket_id);
    return { ...ticket, patients_ahead: ahead, eta_minutes: ahead * MINUTES_PER_PATIENT };
  };

  // Health check: the load balancer and Docker call this
  const health = (req, res) => res.json({ status: 'ok' });
  app.get('/health', health);
  app.get('/api/health', health);

  // Patient checks in
  app.post('/api/tickets', (req, res) => {
    const { facility_id, department } = req.body || {};
    if (!isFacility(facility_id)) {
      return res.status(400).json({ error: 'facility_id must be 3-32 characters: A-Z, 0-9, underscore' });
    }
    if (!DEPARTMENTS.includes(department)) {
      return res.status(400).json({ error: 'unknown department', allowed: DEPARTMENTS });
    }
    const ticket = {
      ticket_id: newTicketId(tickets),
      facility_id,
      department,
      arrival_time: new Date().toISOString(),
      status: 'WAITING',
      assigned_room: null,
    };
    tickets.push(ticket);
    return res.status(201).json(present(ticket));
  });

  // Queue list for the doctor desk
  app.get('/api/tickets', (req, res) => {
    const { facility_id, department } = req.query;
    if (!isFacility(facility_id)) {
      return res.status(400).json({ error: 'facility_id is required' });
    }
    const list = tickets
      .filter((t) => t.facility_id === facility_id)
      .filter((t) => !department || t.department === department)
      .map(present);
    return res.json(list);
  });

  // Doctor presses "Call Next"
  app.post('/api/queue/call-next', (req, res) => {
    const { facility_id, department, room } = req.body || {};
    if (!isFacility(facility_id) || !DEPARTMENTS.includes(department)) {
      return res.status(400).json({ error: 'facility_id and a valid department are required' });
    }
    const next = waitingIn(facility_id, department)[0];
    if (!next) {
      return res.status(404).json({ error: 'queue is empty' });
    }
    next.status = 'IN_PROGRESS';
    next.assigned_room =
      typeof room === 'string' && room.trim() ? room.trim().slice(0, 40) : 'Consultation Room 1';
    return res.json(present(next));
  });

  // Visit finished
  app.post('/api/tickets/:id/complete', (req, res) => {
    const { facility_id } = req.body || {};
    if (!isFacility(facility_id)) {
      return res.status(400).json({ error: 'facility_id is required' });
    }
    const ticket = tickets.find((t) => t.ticket_id === req.params.id && t.facility_id === facility_id);
    if (!ticket) {
      return res.status(404).json({ error: 'ticket not found' });
    }
    ticket.status = 'COMPLETED';
    return res.json(present(ticket));
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));

  // Bad JSON and other errors come back as JSON, not HTML
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status && err.status < 500 ? err.status : 500;
    res.status(status).json({ error: status === 500 ? 'internal error' : 'bad request' });
  });

  return app;
}

module.exports = { createApp, DEPARTMENTS };
