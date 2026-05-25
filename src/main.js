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

// Google Maps Raster Tiles (Default with POIs)
const googleMapsLayer = L.tileLayer('http://mt0.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}', {
  maxZoom: 20,
  attribution: '© Google Maps'
});

// Clean Map (CartoDB Voyager - no POIs)
const cleanMapsLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  maxZoom: 20,
  attribution: '© OpenStreetMap, © CartoDB'
});

googleMapsLayer.addTo(map);

document.getElementById('toggle-google-pois').addEventListener('change', (e) => {
  if (e.target.checked) {
    map.removeLayer(googleMapsLayer);
    cleanMapsLayer.addTo(map);
  } else {
    map.removeLayer(cleanMapsLayer);
    googleMapsLayer.addTo(map);
  }
});

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
        uid: user.uid,
        email: user.email,
        name: user.displayName,
        avatarUrl: user.photoURL
      });
    } catch(e) {}
    
    // Update avatar image
    const avatarDiv = document.getElementById('user-avatar');
    if (user.photoURL) {
      avatarDiv.innerHTML = `<img src="${user.photoURL}" alt="avatar">`;
    }
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

document.getElementById('btn-confirm-pin').addEventListener('click', async () => {
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
  
  // Auto-fill address via Nominatim Reverse Geocoding
  document.getElementById('add-address').value = 'Đang tự động lấy địa chỉ...';
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${selectedLat}&lon=${selectedLng}`);
    const data = await res.json();
    if (data && data.display_name) {
      document.getElementById('add-address').value = data.display_name;
    } else {
      document.getElementById('add-address').value = '';
    }
  } catch (err) {
    document.getElementById('add-address').value = '';
  }
});

// Forward Geocoding (Search Box)
const searchInput = document.getElementById('search-input');
if (searchInput) {
  searchInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value;
      if (!query) return;
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=vn`);
        const data = await res.json();
        if (data && data.length > 0) {
          const { lat, lon } = data[0];
          map.flyTo([lat, lon], 16);
          // Auto trigger pin selector mode if logged in, for convenience
          if (currentUser) {
            pinSelectorUI.classList.remove('hidden');
            centerCrosshair.classList.remove('hidden');
            addBtn.classList.add('hidden');
            if (window.innerWidth < 768) {
              bottomSheet.style.transform = 'translateY(100%)';
            }
          }
        } else {
          showToast("Không tìm thấy địa điểm này!");
        }
      } catch (err) {
        showToast("Lỗi tìm kiếm");
      }
    }
  });
}

// Close Modals
document.getElementById('btn-close-login').addEventListener('click', () => {
  modalOverlay.classList.add('hidden');
});
document.getElementById('btn-cancel-note').addEventListener('click', () => {
  modalOverlay.classList.add('hidden');
});

// Google Login
document.getElementById('btn-login-google').addEventListener('click', async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    currentUser = result.user;
    
    try {
      await axios.post(`${API_BASE}/auth/sync`, {
        uid: currentUser.uid,
        email: currentUser.email,
        name: currentUser.displayName,
        avatarUrl: currentUser.photoURL
      });
    } catch(e) {}
    
    showToast(`Xin chào ${currentUser.displayName}`);
    loginModal.classList.add('hidden');
    modalOverlay.classList.add('hidden'); // Hide overlay completely
    
    // Start pin selection process
    pinSelectorUI.classList.remove('hidden');
    centerCrosshair.classList.remove('hidden');
    addBtn.classList.add('hidden');
    if (window.innerWidth < 768) {
      bottomSheet.style.transform = 'translateY(100%)';
    }
    
    // Update avatar image
    const avatarDiv = document.getElementById('user-avatar');
    if (currentUser.photoURL) {
      avatarDiv.innerHTML = `<img src="${currentUser.photoURL}" alt="avatar">`;
    }
  } catch (error) {
    showToast("Đăng nhập thất bại");
  }
});

// Logout Feature
document.getElementById('user-avatar').addEventListener('click', async () => {
  if (currentUser) {
    if (confirm("Bạn có muốn đăng xuất và xóa dữ liệu cục bộ không?")) {
      await auth.signOut();
      localStorage.removeItem('foodnote_offline_data');
      localStorage.removeItem('foodnote_user');
      showToast("Đã đăng xuất và xóa dữ liệu cục bộ");
      document.getElementById('user-avatar').innerHTML = '👤';
      renderNotes([]); // Clear map
    }
  }
});

let allNotesData = [];

// Toggle My Notes
document.getElementById('toggle-my-notes').addEventListener('change', (e) => {
  if (e.target.checked && !currentUser) {
    showToast("Bạn cần đăng nhập để xem địa điểm của riêng mình!");
    e.target.checked = false;
    return;
  }
  renderNotes();
});

// Render Notes
function renderNotes(data) {
  if (data) {
    allNotesData = data;
  }
  
  const showOnlyMine = document.getElementById('toggle-my-notes').checked;
  const notesToRender = showOnlyMine 
    ? allNotesData.filter(note => currentUser && note.userId === currentUser.uid)
    : allNotesData;

  noteList.innerHTML = '';
  
  // Clear existing markers (basic implementation, ideally keep track of layer group)
  map.eachLayer((layer) => {
    if (layer instanceof L.Marker) map.removeLayer(layer);
  });

  if (notesToRender.length === 0) {
    noteList.innerHTML = '<div class="loading-text" style="text-align:center; padding: 20px;">Không có địa điểm nào.</div>';
    return;
  }

  notesToRender.forEach(note => {
    const marker = L.marker([note.lat, note.lng]).addTo(map);
    
    // Add popup to marker
    const popupContent = `
      <div style="font-family: 'Inter', sans-serif; min-width: 150px; text-align: left;">
        <h4 style="margin: 0 0 4px 0; color: #1a73e8; font-size: 14px; font-weight: 600;">${note.title}</h4>
        ${note.address ? `<p style="margin: 0 0 6px 0; font-size: 11px; color: #5f6368;">📍 ${note.address}</p>` : ''}
        <div style="font-size: 12px; font-weight: 500; color: #fbbc04;">⭐ ${note.rating?.toFixed(1) || '5.0'}</div>
      </div>
    `;
    marker.bindPopup(popupContent);
    
    let imgTag = '';
    if (note.imageUrl) {
      try {
        const urls = JSON.parse(note.imageUrl);
        if (urls.length > 0) imgTag = `<img class="note-image" src="${API_BASE.replace('/api', '')}${urls[0]}" alt="food image">`;
      } catch(e) {
        imgTag = `<img class="note-image" src="${API_BASE.replace('/api', '')}${note.imageUrl}" alt="food image">`;
      }
    }

    const el = document.createElement('div');
    el.className = 'note-card';
    el.innerHTML = `
      <div class="note-header">
        <div class="note-title">${note.title}</div>
        <div class="note-rating">⭐ ${note.rating?.toFixed(1) || '5.0'}</div>
      </div>
      <div class="note-desc">${note.description}</div>
      ${imgTag}
      <div class="action-buttons">
        <a href="https://www.google.com/maps/search/?api=1&query=${note.lat},${note.lng}" target="_blank" class="nav-btn">📍 Google Maps</a>
        <a href="http://maps.apple.com/?ll=${note.lat},${note.lng}&q=${note.title}" target="_blank" class="nav-btn">🍎 Apple Maps</a>
      </div>
    `;

    el.addEventListener('click', (e) => {
      if (e.target.closest('.nav-btn')) return;
      openDetailModal(note);
      map.flyTo([note.lat, note.lng], 16);
      marker.openPopup();
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

// Image Selection
let selectedImageFiles = [];
document.getElementById('add-image').addEventListener('change', (e) => {
  if (e.target.files) {
    selectedImageFiles = Array.from(e.target.files);
    document.getElementById('upload-text').textContent = `Đã chọn: ${selectedImageFiles.length} ảnh`;
  }
});

let selectedReviewFiles = [];
document.getElementById('review-image').addEventListener('change', (e) => {
  if (e.target.files) {
    selectedReviewFiles = Array.from(e.target.files);
    document.getElementById('review-upload-text').textContent = `Đã chọn: ${selectedReviewFiles.length} ảnh`;
  }
});

async function uploadFiles(files) {
  const urls = [];
  for (const file of files) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(`${API_BASE}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    urls.push(res.data.url);
  }
  return urls;
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

  let imageUrl = null;
  if (selectedImageFiles.length > 0) {
    document.getElementById('btn-submit-note').textContent = "Đang tải ảnh...";
    document.getElementById('btn-submit-note').disabled = true;
    try {
      const urls = await uploadFiles(selectedImageFiles);
      imageUrl = JSON.stringify(urls);
    } catch (e) {
      showToast("Lỗi tải ảnh lên");
    }
    document.getElementById('btn-submit-note').textContent = "Lưu lại";
    document.getElementById('btn-submit-note').disabled = false;
  }
  
  const payload = {
    id: Date.now().toString(),
    title,
    description: desc,
    address,
    isPublic: privacy,
    lat: selectedLat,
    lng: selectedLng,
    userId: currentUser.uid,
    rating: 5,
    imageUrl
  };
  
  modalOverlay.classList.add('hidden');
  document.getElementById('add-title').value = '';
  document.getElementById('add-address').value = '';
  document.getElementById('add-desc').value = '';
  document.getElementById('add-image').value = '';
  document.getElementById('upload-text').textContent = "Thêm ảnh (Tùy chọn)";
  selectedImageFiles = [];

  try {
    const res = await axios.post(`${API_BASE}/notes`, payload);
    showToast(res.data.message || "Đã lưu địa điểm thành công!");
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

let currentActiveNoteId = null;

// Submit Review
document.getElementById('btn-submit-review').addEventListener('click', async () => {
  if (!currentActiveNoteId || !currentUser) return;
  const comment = document.getElementById('review-comment').value;
  if (!comment) return showToast("Vui lòng nhập đánh giá");

  let imageUrl = null;
  if (selectedReviewFiles.length > 0) {
    document.getElementById('btn-submit-review').textContent = "Đang tải ảnh...";
    document.getElementById('btn-submit-review').disabled = true;
    try {
      const urls = await uploadFiles(selectedReviewFiles);
      imageUrl = JSON.stringify(urls);
    } catch (e) {}
    document.getElementById('btn-submit-review').textContent = "Gửi đánh giá";
    document.getElementById('btn-submit-review').disabled = false;
  }

  try {
    await axios.post(`${API_BASE}/reviews`, {
      noteId: currentActiveNoteId,
      userId: currentUser.uid,
      comment,
      imageUrl
    });
    showToast("Đã thêm đánh giá!");
    document.getElementById('review-comment').value = '';
    document.getElementById('review-image').value = '';
    document.getElementById('review-upload-text').textContent = "Thêm ảnh";
    selectedReviewFiles = [];
    document.getElementById('add-review-form').classList.add('hidden');
    document.getElementById('btn-open-review-form').classList.remove('hidden');
    openDetailModal(allNotesData.find(n => n.id === currentActiveNoteId));
  } catch (e) {
    showToast("Lỗi thêm đánh giá");
  }
});

document.getElementById('btn-open-review-form').addEventListener('click', () => {
  if (!currentUser) return showToast("Vui lòng đăng nhập để đánh giá");
  document.getElementById('btn-open-review-form').classList.add('hidden');
  document.getElementById('add-review-form').classList.remove('hidden');
});

document.getElementById('btn-cancel-review').addEventListener('click', () => {
  document.getElementById('btn-open-review-form').classList.remove('hidden');
  document.getElementById('add-review-form').classList.add('hidden');
});

document.getElementById('btn-close-detail').addEventListener('click', () => {
  document.getElementById('detail-modal').classList.add('hidden');
  modalOverlay.classList.add('hidden');
  currentActiveNoteId = null;
});

async function openDetailModal(note) {
  currentActiveNoteId = note.id;
  document.getElementById('detail-title').textContent = note.title;
  document.getElementById('detail-address').textContent = note.address || '';
  document.getElementById('detail-desc').textContent = note.description;
  
  const imagesContainer = document.getElementById('detail-images');
  imagesContainer.innerHTML = '';
  if (note.imageUrl) {
    try {
      const urls = JSON.parse(note.imageUrl);
      urls.forEach(url => {
        imagesContainer.innerHTML += `<img class="carousel-image" src="${API_BASE.replace('/api', '')}${url}">`;
      });
    } catch(e) {
      // old format
      imagesContainer.innerHTML = `<img class="carousel-image" src="${API_BASE.replace('/api', '')}${note.imageUrl}">`;
    }
  }

  modalOverlay.classList.remove('hidden');
  loginModal.classList.add('hidden');
  addNoteModal.classList.add('hidden');
  document.getElementById('detail-modal').classList.remove('hidden');
  
  document.getElementById('add-review-form').classList.add('hidden');
  document.getElementById('btn-open-review-form').classList.remove('hidden');

  // Load reviews
  const reviewList = document.getElementById('review-list');
  reviewList.innerHTML = '<div class="loading-text">Đang tải đánh giá...</div>';
  try {
    const res = await axios.get(`${API_BASE}/notes/${note.id}/reviews`);
    const reviews = res.data;
    if (reviews.length === 0) {
      reviewList.innerHTML = '<div class="loading-text" style="text-align:left; padding: 10px 0;">Chưa có đánh giá nào. Hãy là người đầu tiên!</div>';
    } else {
      reviewList.innerHTML = reviews.map(r => {
        let imgs = '';
        if (r.imageUrl) {
          try {
            const rUrls = JSON.parse(r.imageUrl);
            imgs = `<div class="image-carousel" style="display:flex; overflow-x:auto; gap:4px; margin-top:8px;">
              ${rUrls.map(u => `<img style="height:60px; border-radius:4px; object-fit:cover;" src="${API_BASE.replace('/api', '')}${u}">`).join('')}
            </div>`;
          } catch(e) {}
        }
        return `
          <div class="review-card">
            <div class="review-header">
              <img class="review-avatar" src="${r.userAvatar || 'https://via.placeholder.com/24'}">
              <span class="review-name">${r.userName}</span>
              <span class="review-date">${new Date(r.createdAt).toLocaleDateString()}</span>
            </div>
            <div style="font-size:0.9rem; margin-top:4px;">${r.comment}</div>
            ${imgs}
          </div>
        `;
      }).join('');
    }
  } catch (e) {
    reviewList.innerHTML = '<div class="loading-text">Lỗi tải đánh giá</div>';
  }
}

// Load Notes
loadNotes();
