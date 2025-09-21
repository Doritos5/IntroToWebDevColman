const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/authMiddleware');
const {
    renderCatalogPage,
    getCatalogData,
    getCatalogByQuery
} = require('../controllers/catalogController');

router.get('/', isAuthenticated, renderCatalogPage);


router.get('/data', isAuthenticated, getCatalogData);


router.get("/search/", isAuthenticated, getCatalogByQuery);
router.get("/search/:query", isAuthenticated, getCatalogByQuery);

module.exports = router;

