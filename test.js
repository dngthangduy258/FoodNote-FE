const puppeteer = require('puppeteer');
(async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    
    console.log('Navigating to https://foodnote-fe-2.pages.dev/');
    await page.goto('https://foodnote-fe-2.pages.dev/', {waitUntil: 'networkidle2'});
    
    // Check if map exists
    const mapExists = await page.#map;
    console.log('Map element exists:', !!mapExists);
    
    // Check if leaflet markers are present
    const leafletObjects = await page.evaluate(() => {
      return document.querySelectorAll('.leaflet-marker-icon').length;
    });
    console.log('Leaflet markers/clusters found:', leafletObjects);
    
    // Check Bottom Nav
    const bottomNav = await page..bottom-nav;
    console.log('Bottom Nav exists:', !!bottomNav);
    
    // Check errors
    const errors = await page.evaluate(() => window.errors || []);
    console.log('Window errors:', errors);
    
    await browser.close();
  } catch (err) {
    console.error('Test failed:', err);
  }
})();
