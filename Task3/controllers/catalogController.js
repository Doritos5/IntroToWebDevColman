const { getCatalog } = require('../models/catalogModel');

async function renderCatalogPage(_req, res, next) {
    try {
        const catalog = await getCatalog();
        res.render('catalog', {
            catalog,
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    renderCatalogPage,
};