// Flashcards use five Leitner boxes. A correct recall moves a card up one box; a miss sends it back to box 1.
import {addDays} from './planner.js';

export const BOX_DAYS = [0, 1, 3, 7, 14, 30];

export function review(cardState = {box: 0}, knewIt, today) {
  const box = knewIt ? Math.min((cardState.box || 0) + 1, BOX_DAYS.length - 1) : 1;
  return {box, due: addDays(today, BOX_DAYS[box]), seen: (cardState.seen || 0) + 1};
}

export function dueCards(flashcards, cardStates, today, domain = null) {
  return flashcards.filter(c => (!domain || c.domain === domain) && (!cardStates[c.id] || cardStates[c.id].due <= today));
}

export const mastered = (cardStates) => Object.values(cardStates).filter(s => s.box >= 4).length;
