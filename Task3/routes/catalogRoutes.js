const express = require('express');
const { renderCatalogPage,
        getCatalogByQuery} = require('../controllers/catalogController');

const router = express.Router();

const { isAuthenticated } = require('../middleware/authMiddleware');

router.get('/', renderCatalogPage);
router.get("/search/", getCatalogByQuery); // i do this for empty query - i.e. textbox is empty
router.get("/search/:query", getCatalogByQuery);
router.get('/', isAuthenticated, (req, res) => {
    res.render('catalog');
});

module.exports = router;