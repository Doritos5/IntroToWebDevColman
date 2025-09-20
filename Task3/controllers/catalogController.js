const { generateCatalogFeed } = require('../models/catalogModel');

async function getCatalogHtml(req, res, next) {
    try {
        const catalogFeed = await generateCatalogFeed();
        res.render('catalog', {
            catalogFeed,
        });
    } catch (error) {
        next(error);
    }
}

async function renderCatalogPage(req, res, next) {
    return await getCatalogHtml(req, res, next);
}


async function getCatalogByQuery(req, res, next) {
    const query = req.params.query;
    let queryFunc = query ? item => item.title.toLowerCase().includes(query.trim().toLowerCase()) : item => item

    let feedHtmlRes = await generateCatalogFeed(queryFunc);
    return res.type("html").send(feedHtmlRes);
}

module.exports = {
    renderCatalogPage,
    getCatalogByQuery
};

