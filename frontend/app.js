// ============================================
// SafeHer - Frontend Application JavaScript
// ============================================

// Global Variables
let map;
let dashboardMap;
let userMarker;
let policeMarkers = [];
let journeyInterval;
let shareInterval;
let sosInterval;
let currentJourney = null;
let socket;
let userLocation = { lat: 0, lng: 0 };
let shareDuration = 15; // minutes

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    // Hide loader after page loads
    setTimeout(() => {
        document.getElementById('loader').classList.add('hidden');
        document.getElementById('appContainer').style.opacity = '1';
    }, 2000);

    // Initialize Socket Connection
    initSocket();

    // Initialize Maps
    initDashboardMap();
    initFullMap();

    // Setup Navigation
    setupNavigation();

    // Setup Menu Toggle
    setupMenuToggle();

    // Get User Location
    getUserLocation();

    // Load Sample Data
    loadSampleData();

    // Setup Event Listeners
    setupEventListeners();
}

// Socket Connection
function initSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to SafeHer Server');
    });

    socket.on('sos-received', (data) => {
        showToast('success', 'SOS Sent', 'Emergency contacts have been notified');
    });

    socket.on('location-shared', (data) => {
        showToast('info', 'Location Shared', 'Your live location is being shared');
    });
}

// Initialize Dashboard Map
function initDashboardMap() {
    dashboardMap = L.map('dashboardMap', {
        zoomControl: false
    }).setView([0, 0], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(dashboardMap);
}

// Initialize Full Map
function initFullMap() {
    map = L.map('fullMap', {
        zoomControl: true
    }).setView([0, 0], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add custom zoom control position
    map.zoomControl.setPosition('topright');
}

// Get User Location
function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation.lat = position.coords.latitude;
                userLocation.lng = position.coords.longitude;
                
                // Update both maps
                updateMapLocation(dashboardMap, userLocation.lat, userLocation.lng);
                updateMapLocation(map, userLocation.lat, userLocation.lng);
                
                // Update safety score
                analyzeSafety();
                
                // Find nearby help
                findNearbyHelp();
            },
            (error) => {
                console.error('Geolocation error:', error);
                showToast('error', 'Location Error', 'Unable to get your location');
                // Default to a sample location
                userLocation = { lat: 40.7128, lng: -74.0060 };
                updateMapLocation(dashboardMap, userLocation.lat, userLocation.lng);
                updateMapLocation(map, userLocation.lat, userLocation.lng);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }
}

// Update Map Location
function updateMapLocation(mapInstance, lat, lng) {
    if (userMarker) {
        userMarker.setLatLng([lat, lng]);
    } else {
        userMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'custom-marker',
                html: '<i class="fas fa-user"></i>',
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            })
        }).addTo(mapInstance).bindPopup('You are here');
    }
    mapInstance.setView([lat, lng], 15);
}

// Find Nearby Help (Police, Hospitals, etc.)
async function findNearbyHelp() {
    try {
        // Fetch nearby police stations
        const policeResponse = await fetch(`/api/safety/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}&type=police&radius=5000`);
        const policeData = await policeResponse.json();
        
        if (policeData.success) {
            displayNearbyPlaces(policeData.data, 'police');
            updateNearestPolice(policeData.data);
        }

        // Fetch nearby hospitals
        const hospitalResponse = await fetch(`/api/safety/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}&type=hospital&radius=10000`);
        const hospitalData = await hospitalResponse.json();
        
        if (hospitalData.success) {
            displayNearbyPlaces(hospitalData.data, 'hospital');
        }

    } catch (error) {
        console.error('Error finding nearby help:', error);
        // Use sample data as fallback
        displaySampleNearbyPlaces();
    }
}

// Display Nearby Places on Map
function displayNearbyPlaces(places, type) {
    places.forEach(place => {
        const icon = L.divIcon({
            className: `custom-marker ${type}`,
            html: `<i class="fas fa-${type === 'police' ? 'shield-alt' : 'hospital'}"></i>`,
            iconSize: [35, 35],
            iconAnchor: [17, 17]
        });

        const marker = L.marker([place.lat, place.lng], { icon })
            .addTo(map)
            .bindPopup(`
                <b>${place.name}</b><br>
                ${place.address || ''}<br>
                <small>${place.distance} km away</small>
            `);
        
        policeMarkers.push(marker);
    });
}

// Update Nearest Police in UI
function updateNearestPolice(policeStations) {
    if (policeStations.length > 0) {
        const nearest = policeStations[0];
        document.getElementById('nearestPolice').querySelector('.help-info p').textContent = nearest.name;
        document.getElementById('nearestPolice').querySelector('.distance').textContent = `${nearest.distance} km away`;
    }
}

// Display Sample Nearby Places (Fallback)
function displaySampleNearbyPlaces() {
    const samplePolice = [
        { name: 'Central Police Station', lat: userLocation.lat + 0.01, lng: userLocation.lng + 0.01, distance: 1.2 },
        { name: 'North District Station', lat: userLocation.lat - 0.02, lng: userLocation.lng + 0.015, distance: 2.5 }
    ];
    
    const sampleHospitals = [
        { name: 'City General Hospital', lat: userLocation.lat + 0.02, lng: userLocation.lng - 0.01, distance: 2.5 }
    ];
    
    displayNearbyPlaces(samplePolice, 'police');
    displayNearbyPlaces(sampleHospitals, 'hospital');
    
    document.getElementById('nearestPolice').querySelector('.help-info p').textContent = 'Central Police Station';
    document.getElementById('nearestPolice').querySelector('.distance').textContent = '1.2 km away';
}

// AI Safety Analysis
function analyzeSafety() {
    const hour = new Date().getHours();
    let score = 100;
    let status = 'Safe Zone';
    let factors = [];
    let color = 'var(--success)';

    // Time-based analysis
    if (hour >= 22 || hour < 5) {
        score -= 30;
        status = 'Caution: Late Night';
        factors.push({ type: 'warning', text: 'Late Night Travel' });
        color = 'var(--warning)';
    } else if (hour >= 0 && hour < 6) {
        score -= 40;
        status = 'High Risk: Early Morning';
        factors.push({ type: 'danger', text: 'Early Morning Risk' });
        color = 'var(--danger)';
    }

    // Location-based analysis (simulated)
    // In real app, this would check crime rates, lighting, etc.
    const randomFactor = Math.random();
    if (randomFactor > 0.7) {
        score -= 10;
        factors.push({ type: 'warning', text: 'Low Traffic Area' });
    }

    // Update UI
    const scoreCircle = document.querySelector('.circular-chart .circle');
    const scoreText = document.querySelector('.percentage');
    const statusText = document.querySelector('.score-details h4');
    const factorsContainer = document.querySelector('.score-factors');
    const safetyIndicator = document.getElementById('safetyIndicator');

    scoreText.textContent = score;
    scoreCircle.style.strokeDasharray = `${score}, 100`;
    scoreCircle.style.stroke = color;
    statusText.textContent = status;
    statusText.style.color = color;
    
    // Update factors
    factorsContainer.innerHTML = `
        <span class="factor good"><i class="fas fa-check"></i> Police Nearby</span>
        <span class="factor good"><i class="fas fa-check"></i> Well Lit Area</span>
        ${factors.map(f => `<span class="factor ${f.type}"><i class="fas fa-${f.type === 'warning' ? 'exclamation' : 'times'}"></i> ${f.text}</span>`).join('')}
    `;

    // Update header indicator
    safetyIndicator.className = 'safety-indicator';
    if (score < 60) {
        safetyIndicator.classList.add('danger');
        safetyIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>High Risk</span>';
    } else {
        safetyIndicator.innerHTML = '<i class="fas fa-shield-alt"></i><span>Safe Zone</span>';
    }
}

// Navigation Setup
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-links li');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            
            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Show corresponding page
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById(page).classList.add('active');
            
            // Update page title
            document.getElementById('pageTitle').textContent = item.querySelector('span').textContent;
            
            // Close sidebar on mobile
            if (window.innerWidth < 992) {
                document.getElementById('sidebar').classList.remove('active');
                document.getElementById('mainContent').classList.remove('expanded');
            }

            // Refresh map when map page is shown
            if (page === 'map') {
                setTimeout(() => {
                    map.invalidateSize();
                }, 100);
            }
        });
    });
}

// Menu Toggle Setup
function setupMenuToggle() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        mainContent.classList.toggle('expanded');
    });
}

// Event Listeners Setup
function setupEventListeners() {
    // Journey ETA default value
    const etaInput = document.getElementById('journeyETA');
    const now = new Date();
    now.setHours(now.getHours() + 1);
    etaInput.value = now.toISOString().slice(0, 16);

    // History filter
    document.getElementById('historyFilter').addEventListener('change', (e) => {
        filterHistory(e.target.value);
    });
}

// Load Sample Data
function loadSampleData() {
    loadSampleContacts();
    loadSampleHistory();
    loadSampleJourneyCheckpoints();
}

// Load Sample Contacts
function loadSampleContacts() {
    const contacts = [
        { id: 1, name: 'Mom', phone: '+1 234 567 8901', relation: 'family', priority: 1, avatar: 'https://ui-avatars.com/api/?name=Mom&background=ff6b9d&color=fff' },
        { id: 2, name: 'Best Friend Sarah', phone: '+1 234 567 8902', relation: 'friend', priority: 2, avatar: 'https://ui-avatars.com/api/?name=Sarah&background=0984e3&color=fff' },
        { id: 3, name: 'Brother Mike', phone: '+1 234 567 8903', relation: 'family', priority: 3, avatar: 'https://ui-avatars.com/api/?name=Mike&background=00b894&color=fff' }
    ];

    const contactsList = document.getElementById('contactsList');
    contactsList.innerHTML = contacts.map(contact => `
        <div class="contact-item" data-id="${contact.id}">
            <img src="${contact.avatar}" alt="${contact.name}" class="contact-avatar">
            <div class="contact-info">
                <h4>${contact.name}</h4>
                <p>${contact.phone} • ${contact.relation}</p>
            </div>
            <div class="contact-actions">
                <button onclick="callContact('${contact.phone}')" title="Call">
                    <i class="fas fa-phone"></i>
                </button>
                <button onclick="messageContact('${contact.phone}')" title="Message">
                    <i class="fas fa-sms"></i>
                </button>
                <button class="delete" onclick="deleteContact(${contact.id})" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');

    // Update trusted members
    const trustedMembers = document.getElementById('trustedMembers');
    trustedMembers.innerHTML = contacts.slice(0, 2).map(contact => `
        <div class="trusted-member">
            <img src="${contact.avatar}" alt="${contact.name}">
            <div class="trusted-member-info">
                <h4>${contact.name}</h4>
                <span>${contact.relation.charAt(0).toUpperCase() + contact.relation.slice(1)} • Priority ${contact.priority}</span>
            </div>
        </div>
    `).join('');

    // Update SOS contacts
    const sosContacts = document.getElementById('sosContacts');
    sosContacts.innerHTML = contacts.map(contact => `
        <div class="sos-contact">
            <img src="${contact.avatar}" alt="${contact.name}">
            <div class="sos-contact-info">
                <h4>${contact.name}</h4>
                <span>${contact.phone}</span>
            </div>
            <i class="fas fa-check-circle" style="color: var(--success);"></i>
        </div>
    `).join('');
}

// Load Sample History
function loadSampleHistory() {
    const history = [
        { id: 1, type: 'journey', title: 'Journey to Office', description: 'Morning commute completed safely', date: '2024-01-15', time: '08:30 AM', distance: '5.2 km', score: 92 },
        { id: 2, type: 'checkin', title: 'Safe Check-in', description: 'Arrived at destination safely', date: '2024-01-15', time: '09:15 AM', distance: null, score: 100 },
        { id: 3, type: 'journey', title: 'Journey Home', description: 'Evening commute with safe route', date: '2024-01-14', time: '06:00 PM', distance: '5.8 km', score: 88 },
        { id: 4, type: 'sos', title: 'Test SOS', description: 'Emergency alert test', date: '2024-01-10', time: '02:30 PM', distance: null, score: null }
    ];

    const historyList = document.getElementById('historyList');
    historyList.innerHTML = history.map(item => `
        <div class="history-item">
            <div class="history-icon ${item.type}">
                <i class="fas fa-${item.type === 'journey' ? 'route' : item.type === 'sos' ? 'exclamation-triangle' : 'check-circle'}"></i>
            </div>
            <div class="history-content">
                <h4>${item.title}</h4>
                <p>${item.description}</p>
                <div class="history-meta">
                    <span><i class="fas fa-calendar"></i> ${item.date}</span>
                    <span><i class="fas fa-clock"></i> ${item.time}</span>
                    ${item.distance ? `<span><i class="fas fa-road"></i> ${item.distance}</span>` : ''}
                </div>
            </div>
            ${item.score ? `
                <div class="history-score">
                    <div class="score" style="color: ${item.score >= 80 ? 'var(--success)' : item.score >= 60 ? 'var(--warning)' : 'var(--danger)'}">${item.score}</div>
                    <div class="label">Safety</div>
                </div>
            ` : ''}
        </div>
    `).join('');
}

// Load Sample Journey Checkpoints
function loadSampleJourneyCheckpoints() {
    const checkpoints = [
        { name: 'Start Point', status: 'safe', time: '08:30 AM' },
        { name: 'Main Street Crossing', status: 'safe', time: '08:35 AM' },
        { name: 'Park Entrance', status: 'safe', time: '08:42 AM' },
        { name: 'Office Building', status: 'safe', time: '08:55 AM' }
    ];

    const checkpointsContainer = document.getElementById('checkpoints');
    checkpointsContainer.innerHTML = `
        <h4>Safety Checkpoints</h4>
        ${checkpoints.map(cp => `
            <div class="checkpoint">
                <i class="fas fa-map-marker-alt" style="color: var(--success);"></i>
                <span>${cp.name} - ${cp.status.charAt(0).toUpperCase() + cp.status.slice(1)} (${cp.time})</span>
            </div>
        `).join('')}
    `;
}

// ============================================
// SOS Emergency Functions
// ============================================

function triggerSOS() {
    const modal = document.getElementById('sosModal');
    modal.classList.add('active');
    
    // Start countdown
    let countdown = 10;
    document.getElementById('sosCountdown').textContent = countdown;
    
    sosInterval = setInterval(() => {
        countdown--;
        document.getElementById('sosCountdown').textContent = countdown;
        
        if (countdown <= 0) {
            confirmSOS();
        }
    }, 1000);
}

function confirmSOS() {
    clearInterval(sosInterval);
    
    // Play alarm sound
    playAlarmSound();
    
    // Get current location
    const location = {
        lat: userLocation.lat,
        lng: userLocation.lng,
        timestamp: new Date().toISOString()
    };
    
    // Send SOS via socket
    socket.emit('sos-trigger', {
        userId: 'user123',
        location: location,
        message: 'EMERGENCY SOS activated!'
    });
    
    // Also send via API
    sendSOSAPI(location);
    
    // Close modal
    document.getElementById('sosModal').classList.remove('active');
    
    // Show confirmation
    showToast('danger', 'SOS Sent', 'Emergency contacts have been notified');
    
    // Log activity
    logActivity('sos', 'Emergency SOS activated', location);
}

function cancelSOS() {
    clearInterval(sosInterval);
    document.getElementById('sosModal').classList.remove('active');
    showToast('info', 'SOS Cancelled', 'Emergency alert has been cancelled');
}

async function sendSOSAPI(location) {
    try {
        const response = await fetch('/api/sos/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                location: location,
                message: 'EMERGENCY SOS activated! I need help immediately.'
            })
        });
        
        const data = await response.json();
        if (data.success) {
            console.log('SOS sent successfully');
        }
    } catch (error) {
        console.error('Error sending SOS:', error);
    }
}

function playAlarmSound() {
    const audio = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg');
    audio.play().catch(err => console.log('Audio play failed:', err));
}

// ============================================
// Location Sharing Functions
// ============================================

function shareLiveLocation() {
    document.getElementById('shareLocationModal').classList.add('active');
}

function setShareDuration(minutes) {
    shareDuration = minutes;
    
    // Update UI
    document.querySelectorAll('.share-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
}

function startSharing() {
    document.getElementById('shareLocationModal').classList.remove('active');
    
    const endTime = shareDuration === 0 
        ? null 
        : new Date(Date.now() + shareDuration * 60 * 1000);
    
    // Start sharing interval
    shareInterval = setInterval(() => {
        // Check if sharing should stop
        if (endTime && new Date() > endTime) {
            stopSharing();
            return;
        }
        
        // Send location update
        socket.emit('share-location', {
            userId: 'user123',
            location: {
                lat: userLocation.lat,
                lng: userLocation.lng,
                timestamp: new Date().toISOString()
            },
            duration: shareDuration
        });
    }, 30000); // Update every 30 seconds
    
    showToast('info', 'Location Sharing Started', `Sharing for ${shareDuration === 0 ? 'until you arrive' : shareDuration + ' minutes'}`);
    
    logActivity('checkin', 'Started location sharing', { duration: shareDuration });
}

function stopSharing() {
    clearInterval(shareInterval);
    showToast('success', 'Location Sharing Stopped', 'Your location is no longer being shared');
}

// ============================================
// Journey Functions
// ============================================

function toggleJourney() {
    const btn = document.getElementById('startJourneyBtn');
    const status = document.getElementById('journeyStatus');
    
    if (currentJourney) {
        // Stop journey
        stopJourney();
        btn.innerHTML = '<i class="fas fa-play"></i> Start Safe Journey';
        status.innerHTML = '<span class="status-dot inactive"></span><span>Inactive</span>';
    } else {
        // Start journey
        startJourney();
        btn.innerHTML = '<i class="fas fa-stop"></i> Stop Journey';
        status.innerHTML = '<span class="status-dot active"></span><span>Active</span>';
    }
}

function startJourney() {
    const destination = document.getElementById('journeyTo').value;
    
    if (!destination) {
        showToast('error', 'Error', 'Please enter a destination');
        return;
    }
    
    currentJourney = {
        destination: destination,
        startTime: new Date(),
        startLocation: { ...userLocation }
    };
    
    // Start tracking
    journeyInterval = setInterval(() => {
        updateJourneyStats();
        checkSafetyCheckpoints();
    }, 1000);
    
    // Draw route on map
    drawRoute();
    
    showToast('success', 'Journey Started', `Heading to ${destination}`);
    
    // Notify trusted contacts
    socket.emit('journey-started', {
        userId: 'user123',
        destination: destination,
        startTime: currentJourney.startTime,
        location: userLocation
    });
    
    logActivity('journey', `Started journey to ${destination}`, currentJourney.startLocation);
}

function stopJourney() {
    clearInterval(journeyInterval);
    
    const journey = currentJourney;
    currentJourney = null;
    
    showToast('success', 'Journey Completed', 'You have arrived safely');
    
    logActivity('journey', `Completed journey to ${journey.destination}`, userLocation);
}

function updateJourneyStats() {
    if (!currentJourney) return;
    
    const elapsed = new Date() - currentJourney.startTime;
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    
    document.getElementById('journeyTime').textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Simulate distance calculation
    const distance = (elapsed / 60000) * 0.5; // Simulated speed
    document.getElementById('journeyDistance').textContent = `${distance.toFixed(1)} km`;
    
    // Update safety score
    const score = calculateJourneySafetyScore();
    document.getElementById('journeySafety').textContent = score;
}

function calculateJourneySafetyScore() {
    // Simulated safety score based on time of day and location
    const hour = new Date().getHours();
    let score = 100;
    
    if (hour >= 22 || hour < 5) {
        score -= 20;
    }
    
    // Add some randomness
    score += Math.floor(Math.random() * 10) - 5;
    
    return Math.max(0, Math.min(100, score));
}

function checkSafetyCheckpoints() {
    // Simulate checkpoint detection
    const checkpoints = [
        'Main Street',
        'Central Park',
        'Shopping Mall',
        'Office District'
    ];
    
    // Randomly add checkpoints
    if (Math.random() > 0.95) {
        const checkpoint = checkpoints[Math.floor(Math.random() * checkpoints.length)];
        const checkpointsContainer = document.getElementById('checkpoints');
        
        const newCheckpoint = document.createElement('div');
        newCheckpoint.className = 'checkpoint';
        newCheckpoint.innerHTML = `
            <i class="fas fa-map-marker-alt" style="color: var(--success);"></i>
            <span>${checkpoint} - Safe (${new Date().toLocaleTimeString()})</span>
        `;
        checkpointsContainer.appendChild(newCheckpoint);
    }
}

function drawRoute() {
    // In a real app, this would use a routing API
    // For demo, we'll just draw a simple line
    const routeCoords = [
        [userLocation.lat, userLocation.lng],
        [userLocation.lat + 0.01, userLocation.lng + 0.01],
        [userLocation.lat + 0.02, userLocation.lng + 0.015],
        [userLocation.lat + 0.03, userLocation.lng + 0.02]
    ];
    
    const routeLine = L.polyline(routeCoords, {
        color: '#ff6b9d',
        weight: 5,
        opacity: 0.8
    }).addTo(map);
    
    map.fitBounds(routeLine.getBounds());
}

// ============================================
// Route Planning Functions
// ============================================

function calculateSafeRoute() {
    const destination = document.getElementById('destinationInput').value;
    
    if (!destination) {
        showToast('error', 'Error', 'Please enter a destination');
        return;
    }
    
    // Simulate route calculation
    const routes = [
        { name: 'Safest Route', time: '25 min', distance: '5.2 km', safety: 95 },
        { name: 'Fastest Route', time: '18 min', distance: '4.1 km', safety: 78 },
        { name: 'Well-lit Route', time: '28 min', distance: '5.8 km', safety: 92 }
    ];
    
    const routeOptions = document.getElementById('routeOptions');
    routeOptions.innerHTML = routes.map((route, index) => `
        <div class="route-option ${index === 0 ? 'selected' : ''}" onclick="selectRoute(this)">
            <div class="route-option-icon">
                <i class="fas fa-route"></i>
            </div>
            <div class="route-option-info">
                <h5>${route.name}</h5>
                <p>${route.time} • ${route.distance} • Safety: ${route.safety}%</p>
            </div>
        </div>
    `).join('');
    
    showToast('success', 'Routes Found', `${routes.length} safe routes found`);
}

function selectRoute(element) {
    document.querySelectorAll('.route-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    element.classList.add('selected');
}

// ============================================
// Map Control Functions
// ============================================

function centerOnUser() {
    map.setView([userLocation.lat, userLocation.lng], 15);
    dashboardMap.setView([userLocation.lat, userLocation.lng], 15);
}

function toggleTrafficLayer() {
    showToast('info', 'Traffic Layer', 'Traffic information loaded');
}

function showPoliceStations() {
    policeMarkers.forEach(marker => {
        if (marker.options.icon.className.includes('police')) {
            marker.openPopup();
        }
    });
}

function showSafeZones() {
    showToast('info', 'Safe Zones', 'Showing verified safe zones');
}

// ============================================
// Contact Management Functions
// ============================================

function openAddContactModal() {
    document.getElementById('addContactModal').classList.add('active');
}

function saveContact() {
    const name = document.getElementById('contactName').value;
    const phone = document.getElementById('contactPhone').value;
    const relation = document.getElementById('contactRelation').value;
    const priority = document.getElementById('contactPriority').value;
    
    if (!name || !phone) {
        showToast('error', 'Error', 'Please fill in all required fields');
        return;
    }
    
    // In a real app, this would save to the backend
    showToast('success', 'Contact Added', `${name} has been added to your emergency contacts`);
    closeModal('addContactModal');
    
    // Reload contacts
    loadSampleContacts();
}

function deleteContact(id) {
    if (confirm('Are you sure you want to delete this contact?')) {
        showToast('success', 'Contact Deleted', 'Contact has been removed');
        loadSampleContacts();
    }
}

function callContact(phone) {
    window.open(`tel:${phone}`, '_blank');
}

function messageContact(phone) {
    window.open(`sms:${phone}`, '_blank');
}

function callEmergency(number) {
    window.open(`tel:${number}`, '_blank');
}

// ============================================
// History Functions
// ============================================

function filterHistory(filter) {
    // In a real app, this would filter from backend
    showToast('info', 'Filter Applied', `Showing ${filter} history`);
}

// ============================================
// Utility Functions
// ============================================

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function showToast(type, title, message) {
    const container = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        </div>
        <div class="toast-content">
            <h4>${title}</h4>
            <p>${message}</p>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function logActivity(type, description, location) {
    // In a real app, this would send to backend
    console.log('Activity logged:', { type, description, location, timestamp: new Date() });
}

// ============================================
// Quick Action Functions
// ============================================

function shareLiveLocation() {
    shareLiveLocation();
}

function startSafeJourney() {
    // Switch to journey tab
    document.querySelector('[data-page="journey"]').click();
    document.getElementById('journeyTo').focus();
}

function startRecording() {
    showToast('info', 'Recording Started', 'Video recording initiated');
    // In a real app, this would start camera recording
}

function showFullMap() {
    // Switch to map tab
    document.querySelector('[data-page="map"]').click();
}

function refreshNearbyHelp() {
    findNearbyHelp();
    showToast('success', 'Refreshed', 'Nearby help locations updated');
}

// ============================================
// Settings Functions
// ============================================

function openChangePasswordModal() {
    showToast('info', 'Change Password', 'Password change modal would open here');
}

function openPrivacyPolicy() {
    showToast('info', 'Privacy Policy', 'Opening privacy policy document');
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        showToast('success', 'Logged Out', 'You have been logged out successfully');
        // In a real app, this would redirect to login page
    }
}