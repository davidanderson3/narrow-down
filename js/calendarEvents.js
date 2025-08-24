import { loadDecisions, saveDecisions, generateId } from './helpers.js';

/**
 * Adds a calendar entry to the app's local schedule.
 * Previously this synced with Google Calendar, but the
 * integration has been removed.
 */
export async function createCalendarEvent(summary, startDate, endDate = startDate) {
  if (!summary || !startDate) return;
  const items = await loadDecisions();
  const newItem = {
    id: generateId(),
    type: 'goal',
    text: summary,
    notes: '',
    completed: false,
    resolution: '',
    dateCompleted: '',
    parentGoalId: null,
    hiddenUntil: null,
    deadline: '',
    scheduled: startDate,
    scheduledEnd: endDate
  };
  await saveDecisions([...items, newItem]);
}
