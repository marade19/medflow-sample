'use strict';

// The page always calls a RELATIVE path (/api/...).
// Locally, nginx forwards /api to the backend container.
// On AWS, CloudFront forwards /api/* to the load balancer.
// Same code, no CORS problems, no hard-coded server addresses.
const FACILITY = 'HOSP_LAG_04';
const DEPARTMENTS = ['General Medicine', 'Pediatrics', 'Laboratory', 'Pharmacy'];

const $ = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Request failed (' + res.status + ')');
  }
  return data;
}

function fillSelect(select) {
  DEPARTMENTS.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });
}

function showMessage(el, text, isError) {
  el.textContent = text;
  el.className = isError ? 'result error' : 'result';
}

async function checkIn() {
  try {
    const ticket = await api('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({ facility_id: FACILITY, department: $('checkin-dept').value }),
    });
    showMessage(
      $('checkin-result'),
      'Your ticket: ' + ticket.ticket_id + '. Patients ahead: ' + ticket.patients_ahead +
        ', estimated wait: ' + ticket.eta_minutes + ' min.',
      false
    );
    refresh();
  } catch (err) {
    showMessage($('checkin-result'), err.message, true);
  }
}

async function callNext() {
  try {
    const ticket = await api('/api/queue/call-next', {
      method: 'POST',
      body: JSON.stringify({
        facility_id: FACILITY,
        department: $('desk-dept').value,
        room: $('desk-room').value,
      }),
    });
    showMessage($('desk-result'), 'Called ' + ticket.ticket_id + ' to ' + ticket.assigned_room, false);
    refresh();
  } catch (err) {
    showMessage($('desk-result'), err.message, true);
  }
}

async function refresh() {
  try {
    const dept = encodeURIComponent($('desk-dept').value);
    const list = await api('/api/tickets?facility_id=' + FACILITY + '&department=' + dept);
    const body = $('queue');
    body.replaceChildren();
    list
      .filter((t) => t.status !== 'COMPLETED')
      .forEach((t) => {
        const row = document.createElement('tr');
        [t.ticket_id, t.status, t.assigned_room || '-', t.eta_minutes === null ? '-' : t.eta_minutes].forEach(
          (value) => {
            const cell = document.createElement('td');
            cell.textContent = String(value); // textContent, never innerHTML
            row.appendChild(cell);
          }
        );
        body.appendChild(row);
      });
  } catch (err) {
    showMessage($('desk-result'), err.message, true);
  }
}

fillSelect($('checkin-dept'));
fillSelect($('desk-dept'));
$('checkin-btn').addEventListener('click', checkIn);
$('callnext-btn').addEventListener('click', callNext);
$('desk-dept').addEventListener('change', refresh);

fetch('build-info.json')
  .then((r) => r.json())
  .then((info) => {
    $('build').textContent = 'Build ' + info.version;
  })
  .catch(() => {});

refresh();
setInterval(refresh, 3000);
