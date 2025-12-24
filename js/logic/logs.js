import { DECISION_LOG_HISTORY_LIMIT, LOG_HISTORY_LIMIT } from '../config.js';
import { parseNumber } from './dice.js';

export const logHistory = [];
export const decisionLogHistory = [];

export const logMessage = (message, tone = 'info') => {
  const timestamp = new Date().toISOString();
  logHistory.unshift({ message, tone, timestamp });
  if (logHistory.length > LOG_HISTORY_LIMIT) {
    logHistory.length = LOG_HISTORY_LIMIT;
  }
};

export const addDecisionLogEntry = (pageNumber, decision) => {
  const timestamp = new Date().toISOString();
  decisionLogHistory.unshift({
    pageNumber,
    decision,
    message: `Page ${pageNumber}: ${decision}`,
    timestamp,
    tone: 'info'
  });
  if (decisionLogHistory.length > DECISION_LOG_HISTORY_LIMIT) {
    decisionLogHistory.length = DECISION_LOG_HISTORY_LIMIT;
  }
};

export const applyLogState = (savedLog = []) => {
  logHistory.length = 0;
  if (Array.isArray(savedLog)) {
    savedLog.slice(0, LOG_HISTORY_LIMIT).forEach((entry) => {
      if (entry && typeof entry.message === 'string') {
        logHistory.push({
          message: entry.message,
          tone: entry.tone || 'info',
          timestamp: entry.timestamp || new Date().toISOString()
        });
      }
    });
  }
};

export const applyDecisionLogState = (savedDecisions = []) => {
  decisionLogHistory.length = 0;
  if (Array.isArray(savedDecisions)) {
    savedDecisions.slice(0, DECISION_LOG_HISTORY_LIMIT).forEach((entry) => {
      if (entry && typeof entry.decision === 'string') {
        const safePage = parseNumber(entry.pageNumber, '', 1, 9999);
        decisionLogHistory.push({
          pageNumber: safePage,
          decision: entry.decision,
          message: entry.message || (safePage ? `Page ${safePage}: ${entry.decision}` : entry.decision),
          timestamp: entry.timestamp || new Date().toISOString(),
          tone: entry.tone || 'info'
        });
      }
    });
  }
};

export const clearLogsForNewGame = () => {
  logHistory.length = 0;
  decisionLogHistory.length = 0;
};
