// New ObjectId-shaped ids (24 hex characters) as strings, for records whose id
// must be known before they are saved (case submission) and for ids that never
// reach MongoDB (AI draft sessions in R2).
const { Types } = require("mongoose");

const generateId = () => new Types.ObjectId().toString();

module.exports = { generateId };
