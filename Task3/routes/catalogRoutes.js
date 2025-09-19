const express = require('express');
const { renderCatalogPage } = require('../controllers/catalogController');

const router = express.Router();

router.get('/', renderCatalogPage);

module.exports = router;