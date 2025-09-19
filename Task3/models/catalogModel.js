const fs = require('fs/promises');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, '..', '..', 'data', 'catalog.json');

async function readCatalogFile() {
    try {
        const data = await fs.readFile(CATALOG_PATH, 'utf8');
        const parsed = JSON.parse(data);
        return Array.isArray(parsed.items) ? parsed.items : [];
    } catch (error) {
        if (error.code === 'ENOENT') {
            await writeCatalogFile([]);
            return [];
        }
        throw error;
    }
}

async function writeCatalogFile(items) {
    const payload = { items };
    await fs.writeFile(CATALOG_PATH, JSON.stringify(payload, null, 2), 'utf8');
}

async function getCatalog() {
    return readCatalogFile();
}

async function incrementLikes(itemId) {
    const items = await readCatalogFile();
    const index = items.findIndex((item) => item.id === itemId);
    if (index === -1) return null;
    items[index].likes += 1;
    await writeCatalogFile(items);
    return items[index];
}

module.exports = {
    getCatalog,
    incrementLikes,
};