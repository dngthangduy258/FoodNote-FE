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
const map = L.map('map', {
  center: [10.8231, 106.6297],
  zoom: 13,
  zoomControl: false // Disable default zoom control to position it better
});

L.control.zoom({
  position: 'bottomright'
}).addTo(map);

// Add marker cluster group
const markersCluster = L.markerClusterGroup({
  disableClusteringAtZoom: 17,
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false
});
map.addLayer(markersCluster);

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

let pendingAction = null;

function startPinSelector() {
  pinSelectorUI.classList.remove('hidden');
  centerCrosshair.classList.remove('hidden');
  addBtn.classList.add('hidden');
  if (window.innerWidth < 768) {
    bottomSheet.style.transform = 'translateY(100%)'; // hide sheet completely
  }
}

// Add Flow
addBtn.addEventListener('click', () => {
  if (!currentUser) {
    pendingAction = 'addNote';
    modalOverlay.classList.remove('hidden');
    loginModal.classList.remove('hidden');
    addNoteModal.classList.add('hidden');
  } else {
    startPinSelector();
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

// GPS Location tracking
const gpsBtn = document.getElementById('gps-btn');
if (gpsBtn) {
  gpsBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
      showToast("Đang tìm vị trí...");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          map.flyTo([lat, lng], 16);
          L.popup()
            .setLatLng([lat, lng])
            .setContent("Bạn đang ở đây")
            .openOn(map);
        },
        () => {
          showToast("Không thể định vị. Vui lòng bật GPS.");
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      showToast("Trình duyệt không hỗ trợ định vị.");
    }
  });
}

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
            startPinSelector();
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
  pendingAction = null;
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
    
    if (pendingAction === 'addNote') {
      startPinSelector();
    } else if (pendingAction === 'myNotes') {
      document.getElementById('toggle-my-notes').checked = true;
      renderNotes();
    }
    pendingAction = null;
    
    // Update avatar image
    const avatarDiv = document.getElementById('user-avatar');
    if (currentUser.photoURL) {
      avatarDiv.innerHTML = `<img src="${currentUser.photoURL}" alt="avatar">`;
    }
  } catch (error) {
    showToast("Đăng nhập thất bại");
  }
});

// Login / Logout Avatar Click
document.getElementById('user-avatar').addEventListener('click', async () => {
  if (currentUser) {
    if (confirm("Bạn có muốn đăng xuất và xóa dữ liệu cục bộ không?")) {
      await auth.signOut();
      localStorage.removeItem('foodnote_offline_data');
      localStorage.removeItem('foodnote_user');
      showToast("Đã đăng xuất và xóa dữ liệu cục bộ");
      document.getElementById('user-avatar').innerHTML = '👤';
      document.getElementById('toggle-my-notes').checked = false;
      loadNotes(); // Reload to show public notes
    }
  } else {
    pendingAction = null;
    modalOverlay.classList.remove('hidden');
    loginModal.classList.remove('hidden');
    addNoteModal.classList.add('hidden');
    document.getElementById('detail-modal').classList.add('hidden');
  }
});

let allNotesData = [];

// Toggle My Notes
document.getElementById('toggle-my-notes').addEventListener('change', (e) => {
  if (e.target.checked && !currentUser) {
    e.target.checked = false;
    pendingAction = 'myNotes';
    modalOverlay.classList.remove('hidden');
    loginModal.classList.remove('hidden');
    addNoteModal.classList.add('hidden');
    document.getElementById('detail-modal').classList.add('hidden');
    return;
  }
  renderNotes(allNotesData);
});

// Render Notes
function renderNotes(notes = []) {
  allNotesData = notes;
  const listEl = document.getElementById('note-list');
  listEl.innerHTML = '';
  markersCluster.clearLayers(); // Clear existing clusters
  
  const showOnlyMine = document.getElementById('toggle-my-notes').checked;
  const notesToRender = showOnlyMine 
    ? allNotesData.filter(note => currentUser && note.userId === currentUser.uid)
    : allNotesData;

  if (notesToRender.length === 0) {
    listEl.innerHTML = '<div class="loading-text" style="text-align:center; padding: 20px;">Không có địa điểm nào.</div>';
    return;
  }

  notesToRender.forEach(note => {
    const marker = L.marker([note.lat, note.lng]).bindPopup(`
      <div style="font-family: 'Inter', sans-serif; min-width: 150px; text-align: left;">
        <h4 style="margin: 0 0 4px 0; color: #1a73e8; font-size: 14px; font-weight: 600;">${note.title}</h4>
        ${note.address ? `<p style="margin: 0 0 6px 0; font-size: 11px; color: #5f6368;">📍 ${note.address}</p>` : ''}
        <div style="font-size: 12px; font-weight: 500; color: #fbbc04;">⭐ ${note.rating?.toFixed(1) || '5.0'}</div>
      </div>
    `);
    marker.on('click', () => openDetailModal(note));
    markersCluster.addLayer(marker); // Add to cluster instead of map
    
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
    
    listEl.appendChild(el);
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

// Star Rating Logic
function setupStarRating(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const stars = container.querySelectorAll('span');
  stars.forEach(star => {
    star.addEventListener('click', (e) => {
      const val = parseInt(e.target.getAttribute('data-val'));
      container.setAttribute('data-rating', val);
      stars.forEach(s => {
        if (parseInt(s.getAttribute('data-val')) <= val) {
          s.classList.add('active');
        } else {
          s.classList.remove('active');
        }
      });
    });
  });
}
setupStarRating('add-rating-stars');
setupStarRating('review-rating-stars');

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
  
  const rating = parseInt(document.getElementById('add-rating-stars').getAttribute('data-rating')) || 5;

  const payload = {
    id: Date.now().toString(),
    title,
    description: desc,
    address,
    isPublic: privacy,
    lat: selectedLat,
    lng: selectedLng,
    userId: currentUser.uid,
    rating: rating,
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
  const reviewRating = parseInt(document.getElementById('review-rating-stars').getAttribute('data-rating')) || 5;
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

  // Edit / Delete Buttons Logic
  const btnEdit = document.getElementById('btn-edit-note');
  const btnDelete = document.getElementById('btn-delete-note');
  
  if (currentUser && currentUser.uid === note.userId) {
    btnEdit.classList.remove('hidden');
    btnDelete.classList.remove('hidden');
    
    // Delete Handle
    btnDelete.onclick = async () => {
      if (confirm("Bạn có chắc chắn muốn xóa địa điểm này?")) {
        try {
          await axios.delete(`${API_BASE}/notes/${note.id}`);
          showToast("Đã xóa địa điểm");
          document.getElementById('detail-modal').classList.add('hidden');
          modalOverlay.classList.add('hidden');
          currentActiveNoteId = null;
          renderNotes([]); // Clear map
          loadNotes(); // Reload public notes
        } catch (e) {
          showToast("Lỗi xóa địa điểm");
        }
      }
    };
    
    // Edit Handle (Basic implementation: reuse add form)
    btnEdit.onclick = () => {
      document.getElementById('detail-modal').classList.add('hidden');
      addNoteModal.classList.remove('hidden');
      
      document.getElementById('add-title').value = note.title;
      document.getElementById('add-address').value = note.address || '';
      document.getElementById('add-desc').value = note.description;
      selectedLat = note.lat;
      selectedLng = note.lng;
      
      // Setting star UI
      const starsContainer = document.getElementById('add-rating-stars');
      starsContainer.setAttribute('data-rating', note.rating || 5);
      starsContainer.querySelectorAll('span').forEach(s => {
        if (parseInt(s.getAttribute('data-val')) <= (note.rating || 5)) s.classList.add('active');
        else s.classList.remove('active');
      });
      
      // Override submit button for Edit mode
      const oldSubmit = document.getElementById('btn-submit-note');
      const newSubmit = oldSubmit.cloneNode(true);
      oldSubmit.parentNode.replaceChild(newSubmit, oldSubmit);
      
      newSubmit.addEventListener('click', async () => {
        const title = document.getElementById('add-title').value;
        const address = document.getElementById('add-address').value;
        const desc = document.getElementById('add-desc').value;
        const rating = parseInt(document.getElementById('add-rating-stars').getAttribute('data-rating')) || 5;
        
        try {
          await axios.put(`${API_BASE}/notes/${note.id}`, {
            title, description: desc, address, rating
          });
          showToast("Đã cập nhật địa điểm!");
          addNoteModal.classList.add('hidden');
          modalOverlay.classList.add('hidden');
          loadNotes();
        } catch(e) {
          showToast("Lỗi cập nhật");
        }
      });
    };
  } else {
    btnEdit.classList.add('hidden');
    btnDelete.classList.add('hidden');
  }

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
        let deleteReviewBtn = '';
        if (currentUser && currentUser.uid === r.userId) {
          deleteReviewBtn = `<button class="btn-text delete-review-btn" data-id="${r.id}" style="color:var(--danger); padding:0; font-size:12px;">Xóa</button>`;
        }
        
        return `
          <div class="review-card">
            <div class="review-header">
              <img class="review-avatar" src="${r.userAvatar || 'https://via.placeholder.com/24'}">
              <span class="review-name">${r.userName}</span>
              <span class="review-date">${new Date(r.createdAt).toLocaleDateString()}</span>
              <div style="flex:1;"></div>
              ${deleteReviewBtn}
            </div>
            <div style="font-size:0.9rem; margin-top:4px;">${r.comment}</div>
            ${imgs}
          </div>
        `;
      }).join('');
      
      // Attach events to delete buttons
      document.querySelectorAll('.delete-review-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.getAttribute('data-id');
          if (confirm("Bạn có chắc muốn xóa đánh giá này?")) {
            try {
              await axios.delete(`${API_BASE}/reviews/${id}`);
              showToast("Đã xóa đánh giá!");
              openDetailModal(allNotesData.find(n => n.id === currentActiveNoteId)); // Reload reviews
            } catch(e) {
              showToast("Lỗi xóa đánh giá");
            }
          }
        });
      });
    }
  } catch (e) {
    reviewList.innerHTML = '<div class="loading-text">Lỗi tải đánh giá</div>';
  }
}

// Load Notes
loadNotes();

// =======================
// Bottom Navigation & Feed
// =======================
const navItems = document.querySelectorAll('.nav-item');
navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const targetTab = e.currentTarget.getAttribute('data-tab');
    
    // Update active class
    navItems.forEach(nav => nav.classList.remove('active'));
    e.currentTarget.classList.add('active');
    
    // Manage Views
    document.getElementById('map').style.display = targetTab === 'map' ? 'block' : 'none';
    document.getElementById('floating-header').style.display = targetTab === 'map' ? 'flex' : 'none';
    const fabs = document.querySelectorAll('.fab');
    fabs.forEach(fab => fab.style.display = targetTab === 'map' ? 'flex' : 'none');
    document.getElementById('bottom-sheet').style.display = targetTab === 'map' ? 'block' : 'none';
    
    document.getElementById('feed-view').classList.toggle('hidden', targetTab !== 'feed');
    document.getElementById('saved-view').classList.toggle('hidden', targetTab !== 'saved');
    document.getElementById('profile-view').classList.toggle('hidden', targetTab !== 'profile');
    
    if (targetTab === 'feed') {
      loadFeed();
    }
  });
});

async function loadFeed() {
  const feedList = document.getElementById('feed-list');
  feedList.innerHTML = '<div class="loading-text">Đang tải bảng tin...</div>';
  try {
    const res = await axios.get(`${API_BASE}/feed`);
    const notes = res.data;
    if (notes.length === 0) {
      feedList.innerHTML = '<div style="text-align:center; color:gray; padding:20px;">Chưa có bài đăng nào.</div>';
      return;
    }
    feedList.innerHTML = notes.map(note => {
      let imgTag = '';
      if (note.imageUrl) {
        try {
          const urls = JSON.parse(note.imageUrl);
          if (urls.length > 0) imgTag = `<img class="feed-image" src="${API_BASE.replace('/api', '')}${urls[0]}" alt="food">`;
        } catch(e) {}
      }
      return `
        <div class="feed-card">
          <div class="feed-header">
            <img class="feed-avatar" src="${note.userAvatar || 'https://via.placeholder.com/32'}" alt="avatar">
            <div style="display:flex; flex-direction:column;">
              <span class="feed-name">${note.userName || 'Người dùng ẩn danh'}</span>
              <span style="font-size:0.8rem; color:var(--text-muted);">${new Date(note.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <div style="font-weight:bold; font-size:1.1rem; margin-bottom:4px;">${note.title}</div>
          <div style="font-size:0.95rem; color:var(--text-color); margin-bottom:8px;">${note.description || ''}</div>
          ${imgTag}
          <div class="feed-actions">
            <button class="feed-action-btn like-btn" data-id="${note.id}" data-type="note">
              ❤️ <span class="like-count">${note.likeCount || 0}</span>
            </button>
            <button class="feed-action-btn" onclick="openDetailModalFromFeed('${note.id}')">
              💬 Bình luận
            </button>
          </div>
        </div>
      `;
    }).join('');
    
    // Attach like events
    document.querySelectorAll('.like-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (!currentUser) {
          showToast("Vui lòng đăng nhập để thích");
          return;
        }
        const targetId = e.currentTarget.getAttribute('data-id');
        const targetType = e.currentTarget.getAttribute('data-type');
        try {
          const res = await axios.post(`${API_BASE}/likes/toggle`, {
            userId: currentUser.uid, targetType, targetId
          });
          const countSpan = e.currentTarget.querySelector('.like-count');
          let count = parseInt(countSpan.textContent);
          if (res.data.action === 'liked') countSpan.textContent = count + 1;
          else countSpan.textContent = count > 0 ? count - 1 : 0;
        } catch(err) {}
      });
    });
  } catch (err) {
    feedList.innerHTML = '<div class="loading-text">Lỗi tải bảng tin</div>';
  }
}

window.openDetailModalFromFeed = (noteId) => {
  const note = allNotesData.find(n => n.id === noteId);
  if (note) openDetailModal(note);
};

window.searchByTag = (tag) => {
  if (tag === 'clear') {
    renderNotes(allNotesData);
    return;
  }
  const filtered = allNotesData.filter(note => {
    return note.description && note.description.toLowerCase().includes(tag.toLowerCase());
  });
  renderNotes(filtered);
  showToast("T�m th?y  d?a di?m");
};
