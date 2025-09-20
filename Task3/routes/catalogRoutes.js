const express = require('express');
const { renderCatalogPage,
        getCatalogByQuery} = require('../controllers/catalogController');

const router = express.Router();

router.get('/', renderCatalogPage);
router.get("/search/", getCatalogByQuery); // i do this for empty query - i.e. textbox is empty
router.get("/search/:query", getCatalogByQuery);

module.exports = router;