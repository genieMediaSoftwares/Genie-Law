const express = require("express");
const faqController = require("../controllers/faq/faqController");

const router = express.Router();

router.get("/", faqController.getFAQs);

module.exports = router;
