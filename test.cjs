const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.stack));
    
    console.log('Navigating to http://localhost:5173');
    await page.goto('http://localhost:5173', {waitUntil: 'networkidle2'});
    
    const mapExists = await page.$('#map');
    console.log('Map element exists:', !!mapExists);
    
    const leafletObjects = await page.evaluate(() => {
      return document.querySelectorAll('.leaflet-marker-icon').length;
    });
    console.log('Leaflet markers/clusters found:', leafletObjects);
    
    await browser.close();
  } catch (err) {
    console.error('Test failed:', err);
  }
})();
