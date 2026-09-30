// Document relevance check (services/ai/documentRelevanceService).
//
// A document is accepted only when the classifier says it is relevant AND is
// at least this confident. The threshold is read from env (AI_RELEVANCE_THRESHOLD);
// the timeout is read from env (AI_RELEVANCE_TIMEOUT_MS).

const aiConfig = require("./ai");

module.exports = {
  RELEVANCE_THRESHOLD: aiConfig.RELEVANCE_THRESHOLD,
  RELEVANCE_TIMEOUT_MS: aiConfig.TIMEOUTS.relevance,
  RELEVANCE_MAX_TEXT_CHARS: aiConfig.RELEVANCE_MAX_TEXT_CHARS,
};
