import './style.css';
import L from 'leaflet';
import axios from 'axios';

// The Backend URL (Cloudflare Worker or localhost depending on dev/prod)
// For now, since user is using MySQL, we assume they will run the backend locally or elsewhere.
// But we'll point it to the local Express server by default.
const API_BASE = 'http://localhost:4000/api';

document.querySelector('#app').innerHTML = `
  <div id="map-container">
    <div id="map"></div>
    <button class="fab" id="add-btn">+</button>
  </div>
  <div id="sidebar">
    <div class="sidebar-header">
      <input type="text" class="search-bar" placeholder="Tìm kiếm địa điểm, tag..." id="search-input" />
    </div>
    <div class="note-list" id="note-list">
      <!-- Notes will be injected here -->
      <div style="text-align: center; color: var(--text-muted); margin-top: 20px;">Đang tải dữ liệu...</div>
    </div>
  </div>
`;

// Initialize Leaflet Map
const map = L.map('map').setView([10.762622, 106.660172], 13); // Default to HCMC

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
}).addTo(map);

// Dummy data for visual presentation while backend is not running
const dummyNotes = [
  {
    id: 1,
    title: 'Phở Hòa Pasteur',
    description: 'Quán phở lâu đời, nước dùng thanh ngọt, thịt bò mềm. Rất hợp để ăn sáng.',
    rating: 4.5,
    tags: ['Phở', 'Ăn sáng'],
    lat: 10.787,
    lng: 106.69
  },
  {
    id: 2,
    title: 'Cafe The Workshop',
    description: 'Không gian yên tĩnh, cà phê specialty ngon. Lý tưởng để làm việc hoặc hẹn hò.',
    rating: 5.0,
    tags: ['Cafe', 'Làm việc', 'Hẹn hò'],
    lat: 10.774,
    lng: 106.704
  }
];

function renderNotes(notes) {
  const list = document.getElementById('note-list');
  list.innerHTML = '';
  
  notes.forEach(note => {
    // Add marker to map
    const marker = L.marker([note.lat, note.lng]).addTo(map);
    marker.bindPopup(`
      <b>${note.title}</b><br>${note.rating} ⭐<br>
      <div style="margin-top: 8px; display: flex; gap: 8px;">
        <a href="https://www.google.com/maps/search/?api=1&query=${note.lat},${note.lng}" target="_blank" style="font-size: 0.8rem; text-decoration: none; background: #ea4335; color: white; padding: 4px 8px; border-radius: 4px;">📍 Google Maps</a>
        <a href="http://maps.apple.com/?ll=${note.lat},${note.lng}&q=${note.title}" target="_blank" style="font-size: 0.8rem; text-decoration: none; background: #000; color: white; padding: 4px 8px; border-radius: 4px;">🍎 Apple Maps</a>
      </div>
    `);

    // Render list item
    const el = document.createElement('div');
    el.className = 'note-card';
    el.innerHTML = `
      <div class="note-header">
        <div class="note-title">${note.title}</div>
        <div class="note-rating">⭐ ${note.rating.toFixed(1)}</div>
      </div>
      <div class="note-desc">${note.description}</div>
      <div class="note-tags">
        ${note.tags.map(t => `<span class="tag">#${t}</span>`).join('')}
      </div>
      <div class="action-buttons" style="margin-top: 12px; display: flex; gap: 8px;">
        <a href="https://www.google.com/maps/search/?api=1&query=${note.lat},${note.lng}" target="_blank" class="nav-btn google-btn">📍 Google Maps</a>
        <a href="http://maps.apple.com/?ll=${note.lat},${note.lng}&q=${note.title}" target="_blank" class="nav-btn apple-btn">🍎 Apple Maps</a>
      </div>
    `;
    
    // Pan to marker on click
    el.addEventListener('click', (e) => {
      // Prevent panning if clicking on the action buttons
      if (e.target.closest('.nav-btn')) return;
      map.flyTo([note.lat, note.lng], 16);
      marker.openPopup();
    });
    
    list.appendChild(el);
  });
}

// Try to fetch from real API, fallback to dummy data
async function loadNotes() {
  try {
    const res = await axios.get(`${API_BASE}/notes`);
    if (res.data && res.data.length > 0) {
      renderNotes(res.data);
    } else {
      renderNotes(dummyNotes);
    }
  } catch (error) {
    console.warn("Backend not running, using dummy data.", error);
    renderNotes(dummyNotes);
  }
}

// Add button listener
document.getElementById('add-btn').addEventListener('click', () => {
  alert("Tính năng thêm địa điểm mới đang được phát triển!");
});

// Initial load
loadNotes();
