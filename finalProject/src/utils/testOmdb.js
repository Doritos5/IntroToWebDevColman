require('dotenv').config();
(async () => {
  const title = process.argv[2] || 'Inception';
  const year = process.argv[3] || '';
  const key = process.env.OMDB_API_KEY;
  if (!key) {
    console.error('OMDB_API_KEY is not set');
    process.exit(2);
  }
  const queryTitle = encodeURIComponent(title.trim());
  const queryYear = year ? `&y=${year}` : '';
  const url = `https://www.omdbapi.com/?t=${queryTitle}${queryYear}&apikey=${key}`;
  const resp = await fetch(url);
  const data = await resp.json();
  console.log('OMDb raw response:', data);
  let rating = 0;
  if (data && data.Response === 'True') {
    if (data.imdbRating && !isNaN(Number(data.imdbRating))) {
      rating = Math.max(0, Math.min(10, Number(data.imdbRating)));
    } else if (Array.isArray(data.Ratings)) {
      const imdbEntry = data.Ratings.find(r => r.Source === 'Internet Movie Database');
      if (imdbEntry && typeof imdbEntry.Value === 'string') {
        const part = imdbEntry.Value.split('/')[0];
        const num = Number(part);
        if (!isNaN(num)) rating = Math.max(0, Math.min(10, num));
      }
    }
  }
  console.log(`Parsed rating for ${title}${year? ' ('+year+')' : ''}:`, rating);
})().catch(err => {
  console.error('Error testing OMDb:', err);
  process.exit(1);
});
