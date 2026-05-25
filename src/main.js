import './style.css';
import L from 'leaflet';
import axios from 'axios';
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";

const API_BASE = 'https://foodnote-api.nnx-agro.workers.dev/api';

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBU5AKtgxqaj5CUDT7mQ8s4_8eCfnbxabE",
  authDomain: "foodnote-5b521.firebaseapp.com",
  projectId: "foodnote-5b521",
  storageBucket: "foodnote-5b521.firebasestorage.app",
  messagingSenderId: "195555300449",
  appId: "1:195555300449:web:84362193ab248753e7c620"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Initialize Leaflet Map (Fullscreen, no zoom controls on mobile)
const map = L.map('map', { zoomControl: false }).setView([10.762622, 106.660172], 13);
L.control.zoom({ position: 'topright' }).addTo(map);

// Google Maps Raster Tiles
L.tileLayer('http://mt0.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}', {
  maxZoom: 20,
  attribution: '© Google Maps'
}).addTo(map);

// Custom Toast System
function showToast(message, duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('hiding');
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

// UI Elements
const modalOverlay = document.getElementById('modal-overlay');
const loginModal = document.getElementById('login-modal');
const addNoteModal = document.getElementById('add-note-modal');
const pinSelectorUI = document.getElementById('pin-selector-ui');
const centerCrosshair = document.getElementById('center-crosshair');
const addBtn = document.getElementById('add-btn');
const bottomSheet = document.getElementById('bottom-sheet');
const noteList = document.getElementById('note-list');

let currentUser = null;
let selectedLat = 0;
let selectedLng = 0;

// Auth State
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    localStorage.setItem('foodnote_user', user.uid);
    
    // Auto sync user to ensure Foreign Key constraints don't fail
    try {
      await axios.post(`${API_BASE}/auth/sync`, {
        email: user.email,
        name: user.displayName,
        avatarUrl: user.photoURL
      });
    } catch(e) {}
  } else {
    currentUser = null;
    localStorage.removeItem('foodnote_user');
  }
});

// Bottom Sheet Physics Mock (Click to expand/collapse)
let sheetExpanded = false;
document.querySelector('.sheet-handle').addEventListener('click', () => {
  if (window.innerWidth < 768) {
    sheetExpanded = !sheetExpanded;
    bottomSheet.style.transform = sheetExpanded ? 'translateY(0)' : 'translateY(calc(100% - 80px))';
  }
});

// Add Flow
addBtn.addEventListener('click', () => {
  if (!currentUser) {
    modalOverlay.classList.remove('hidden');
    loginModal.classList.remove('hidden');
    addNoteModal.classList.add('hidden');
  } else {
    pinSelectorUI.classList.remove('hidden');
    centerCrosshair.classList.remove('hidden');
    addBtn.classList.add('hidden');
    if (window.innerWidth < 768) {
      bottomSheet.style.transform = 'translateY(100%)'; // hide sheet completely
    }
  }
});

document.getElementById('btn-cancel-pin').addEventListener('click', () => {
  pinSelectorUI.classList.add('hidden');
  centerCrosshair.classList.add('hidden');
  addBtn.classList.remove('hidden');
  if (window.innerWidth < 768) {
    bottomSheet.style.transform = 'translateY(calc(100% - 80px))';
  }
});

document.getElementById('btn-confirm-pin').addEventListener('click', () => {
  const center = map.getCenter();
  selectedLat = center.lat;
  selectedLng = center.lng;
  
  pinSelectorUI.classList.add('hidden');
  centerCrosshair.classList.add('hidden');
  addBtn.classList.remove('hidden');
  if (window.innerWidth < 768) {
    bottomSheet.style.transform = 'translateY(calc(100% - 80px))';
  }
  
  modalOverlay.classList.remove('hidden');
  loginModal.classList.add('hidden');
  addNoteModal.classList.remove('hidden');
});

// Close Modals
document.getElementById('btn-close-login').addEventListener('click', () => {
  modalOverlay.classList.add('hidden');
});
document.getElementById('btn-close-add').addEventListener('click', () => {
  modalOverlay.classList.add('hidden');
});

// Google Login
document.getElementById('btn-login-google').addEventListener('click', async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    currentUser = result.user;
    
    try {
      await axios.post(`${API_BASE}/auth/sync`, {
        email: currentUser.email,
        name: currentUser.displayName,
        avatarUrl: currentUser.photoURL
      });
    } catch(e) {}
    
    showToast(`Xin chào ${currentUser.displayName}`);
    loginModal.classList.add('hidden');
    addNoteModal.classList.remove('hidden');
  } catch (error) {
    showToast("Đăng nhập thất bại");
  }
});

// Render Notes
function renderNotes(notes) {
  noteList.innerHTML = '';
  
  // Clear existing markers (basic implementation, ideally keep track of layer group)
  map.eachLayer((layer) => {
    if (layer instanceof L.Marker) map.removeLayer(layer);
  });

  notes.forEach(note => {
    const marker = L.marker([note.lat, note.lng]).addTo(map);
    
    const el = document.createElement('div');
    el.className = 'note-card';
    el.innerHTML = `
      <div class="note-header">
        <div class="note-title">${note.title}</div>
        <div class="note-rating">⭐ ${note.rating?.toFixed(1) || '5.0'}</div>
      </div>
      <div class="note-desc">${note.description}</div>
      <div class="action-buttons">
        <a href="https://www.google.com/maps/search/?api=1&query=${note.lat},${note.lng}" target="_blank" class="nav-btn">📍 Google Maps</a>
        <a href="http://maps.apple.com/?ll=${note.lat},${note.lng}&q=${note.title}" target="_blank" class="nav-btn">🍎 Apple Maps</a>
      </div>
    `;
    
    el.addEventListener('click', (e) => {
      if (e.target.closest('.nav-btn')) return;
      map.flyTo([note.lat, note.lng], 16);
      if (window.innerWidth < 768) {
        sheetExpanded = false;
        bottomSheet.style.transform = 'translateY(calc(100% - 80px))';
      }
    });
    
    noteList.appendChild(el);
  });
}

// Offline First Load Notes
async function loadNotes() {
  const localNotes = JSON.parse(localStorage.getItem('foodnote_offline_data') || '[]');
  
  try {
    const res = await axios.get(`${API_BASE}/notes`);
    if (res.data && res.data.length > 0) {
      renderNotes(res.data);
      localStorage.setItem('foodnote_offline_data', JSON.stringify(res.data)); // Sync
    } else {
      renderNotes(localNotes);
    }
  } catch (error) {
    renderNotes(localNotes);
  }
}

// Submit Note
document.getElementById('btn-submit-note').addEventListener('click', async () => {
  const title = document.getElementById('add-title').value;
  const address = document.getElementById('add-address').value;
  const desc = document.getElementById('add-desc').value;
  const privacy = document.getElementById('add-privacy').checked;
  
  if (!title || !desc) {
    showToast("Vui lòng nhập Tên và Đánh giá");
    return;
  }
  
  const payload = {
    id: Date.now().toString(), // fake ID for offline
    title,
    description: desc,
    address,
    isPublic: privacy,
    lat: selectedLat,
    lng: selectedLng,
    userId: currentUser.uid,
    rating: 5
  };
  
  modalOverlay.classList.add('hidden');
  document.getElementById('add-title').value = '';
  document.getElementById('add-address').value = '';
  document.getElementById('add-desc').value = '';

  try {
    await axios.post(`${API_BASE}/notes`, payload);
    showToast("Đã lưu địa điểm thành công!");
    loadNotes();
  } catch (err) {
    showToast("Đã lưu cục bộ (Chờ đồng bộ Backend)");
    
    // Save to local storage for offline usage
    const localNotes = JSON.parse(localStorage.getItem('foodnote_offline_data') || '[]');
    localNotes.unshift(payload); // Add to top
    localStorage.setItem('foodnote_offline_data', JSON.stringify(localNotes));
    
    renderNotes(localNotes); // Re-render from local
  }
});

// Load
loadNotes();
