const fs = require('fs/promises');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, 'data', 'catalog.json');

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

async function decrementLikes(itemId) {
    const items = await readCatalogFile();
    const index = items.findIndex((item) => item.id === itemId);
    if (index === -1) return null;

    if (items[index].likes > 0) {
        items[index].likes -= 1;
    }

    await writeCatalogFile(items);
    return items[index];
}



function generateCardHTML(item){
    const itemLikes = item.likes;
    const badges = item.genres.map(g => `<span class="badge text-bg-secondary me-1 mb-1">${g}</span>`).join('');

    return `
      <div class="col-6 col-md-4 col-lg-3 mb-4">
        <div class="card h-100 bg-dark text-white">
          <img src="${item.poster}" class="card-img-top" alt="${item.title}">
          <div class="card-body d-flex flex-column">
            <h5 class="card-title mb-1">${item.title}</h5>
            <div class="small text-white-50 mb-2">${item.year}</div>
            <div class="mb-3">${badges}</div>
            <div class="mt-auto d-flex justify-content-between align-items-center">
              <span class="small"><i class="bi bi-heart-fill text-danger me-1"></i>
              <span data-likes="${item.id}">${itemLikes}</span>
              </span>
              <button class="btn btn-sm btn-outline-light" value="${item.id}">Like</button>
            </div>
          </div>
        </div>
      </div>`;
}

async function generateCatalogFeed(filterFunc = null){
    let catalog = await getCatalog();

    if (typeof filterFunc === 'function') {
        catalog = catalog.filter(filterFunc);
    }
    catalog.sort((a, b) => a.title.localeCompare(b.title));

    return catalog.map(generateCardHTML).join('');
}


module.exports = {
    generateCatalogFeed,
    getCatalog,
    incrementLikes,
    decrementLikes
};

