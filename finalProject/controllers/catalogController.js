const catalogModel = require('../models/catalogModel');
const userModel = require('../models/userModel');


async function renderCatalogPage(req, res, next) {
    try {
        const userEmail = req.email;

        const profileId = req.query.profileId;

        const user = await userModel.findUserByEmail(userEmail);

        let profileName = '';
        if (user && profileId) {
            const profile = user.profiles.find(p => p.id === profileId);
            if (profile) {
                profileName = profile.displayName;
            }
        }

        const catalogFeed = await catalogModel.generateCatalogFeed();

        res.render('catalog', {
            catalogFeed: catalogFeed,
            profileName: profileName
        });

    } catch (error) {
        next(error);
    }
}


async function getCatalogByQuery(req, res, next) {
    try {
        const query = req.params.query;
        let queryFunc = query ? item => item.title.toLowerCase().includes(query.trim().toLowerCase()) : null;

        let feedHtmlRes = await catalogModel.generateCatalogFeed(queryFunc);
        return res.type("html").send(feedHtmlRes);
    } catch(error) {
        next(error);
    }
}


async function getCatalogData(req, res) {
    try {
        const userEmail = req.email;
        const { profileId } = req.query;
        const user = await userModel.findUserByEmail(userEmail);

        let likedContent = [];
        if (user && profileId) {
            const profile = user.profiles.find(p => p.id === profileId);
            if (profile) {
                likedContent = profile.likeContent || [];
            }
        }

        const catalog = await catalogModel.getCatalog();

        res.json({
            catalog: catalog,
            likedContent: likedContent
        });

    } catch (error) {
        console.error('Error fetching catalog data:', error);
        res.status(500).json({ message: 'Server error' });
    }
}

module.exports = {
    renderCatalogPage,
    getCatalogByQuery,
    getCatalogData
};