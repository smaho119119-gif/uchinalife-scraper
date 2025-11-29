document.addEventListener('DOMContentLoaded', () => {
    const fileSelect = document.getElementById('fileSelect');
    const refreshBtn = document.getElementById('refreshBtn');
    const dataTableBody = document.querySelector('#dataTable tbody');
    const searchInput = document.getElementById('searchInput');
    const totalItemsSpan = document.getElementById('totalItems');
    const checkedCountSpan = document.getElementById('checkedCount');
    
    // Modal elements
    const modal = document.getElementById('detailModal');
    const closeBtn = document.querySelector('.close');
    const modalTitle = document.getElementById('modalTitle');
    const modalUrl = document.getElementById('modalUrl');
    const modalPrice = document.getElementById('modalPrice');
    const modalFav = document.getElementById('modalFav');
    const modalDates = document.getElementById('modalDates');
    const modalExtraData = document.getElementById('modalExtraData');
    const imageGrid = document.getElementById('imageGrid');
    const modalUseful = document.getElementById('modalUseful');
    const modalNotes = document.getElementById('modalNotes');
    const saveFeedbackBtn = document.getElementById('saveFeedbackBtn');

    let currentData = [];
    let feedbackData = {};
    let currentItem = null;

    // --- Initialization ---
    loadFiles();
    loadFeedback();

    // --- Event Listeners ---
    refreshBtn.addEventListener('click', loadFiles);
    
    fileSelect.addEventListener('change', (e) => {
        if (e.target.value) {
            loadData(e.target.value);
        }
    });

    searchInput.addEventListener('input', (e) => {
        renderTable(e.target.value);
    });

    closeBtn.addEventListener('click', () => {
        modal.style.display = "none";
    });

    window.addEventListener('click', (e) => {
        if (e.target == modal) {
            modal.style.display = "none";
        }
    });

    saveFeedbackBtn.addEventListener('click', saveFeedback);

    // --- Functions ---

    async function loadFiles() {
        try {
            const res = await fetch('/api/files');
            const files = await res.json();
            fileSelect.innerHTML = '<option value="">Select a file...</option>';
            files.forEach(file => {
                const option = document.createElement('option');
                option.value = file;
                option.textContent = file;
                fileSelect.appendChild(option);
            });
        } catch (err) {
            console.error("Error loading files:", err);
        }
    }

    async function loadFeedback() {
        try {
            const res = await fetch('/api/feedback');
            feedbackData = await res.json();
            updateStats();
        } catch (err) {
            console.error("Error loading feedback:", err);
        }
    }

    async function loadData(filename) {
        try {
            const res = await fetch(`/api/data/${filename}`);
            currentData = await res.json();
            renderTable();
            updateStats();
        } catch (err) {
            console.error("Error loading data:", err);
        }
    }

    function renderTable(filterText = "") {
        dataTableBody.innerHTML = "";
        const lowerFilter = filterText.toLowerCase();

        const filtered = currentData.filter(item => {
            return (item.title && item.title.toLowerCase().includes(lowerFilter)) ||
                   (item.price && item.price.toLowerCase().includes(lowerFilter));
        });

        filtered.forEach(item => {
            const tr = document.createElement('tr');
            
            // Check status
            const isChecked = feedbackData[item.url] && feedbackData[item.url].useful;
            const statusHtml = isChecked ? '<span class="status-checked">✔</span>' : '-';

            tr.innerHTML = `
                <td>${statusHtml}</td>
                <td>${item.title || "No Title"}</td>
                <td>${item.price || "-"}</td>
                <td>${item.favorites || "0"}</td>
                <td>${item.update_date || "-"}</td>
                <td>${item.expiry_date || "-"}</td>
                <td><button class="btn-view">View</button></td>
            `;

            tr.querySelector('.btn-view').addEventListener('click', () => openModal(item));
            dataTableBody.appendChild(tr);
        });

        totalItemsSpan.textContent = currentData.length;
    }

    function updateStats() {
        // Count how many items in current list are checked
        if (!currentData.length) return;
        
        let count = 0;
        currentData.forEach(item => {
            if (feedbackData[item.url] && feedbackData[item.url].useful) {
                count++;
            }
        });
        checkedCountSpan.textContent = count;
    }

    function openModal(item) {
        currentItem = item;
        modalTitle.textContent = item.title;
        modalUrl.href = item.url;
        modalUrl.textContent = item.url;
        modalPrice.textContent = item.price;
        modalFav.textContent = item.favorites;
        modalDates.textContent = `Updated: ${item.update_date} | Expiry: ${item.expiry_date}`;
        
        // Images
        imageGrid.innerHTML = "";
        if (item.images) {
            const urls = item.images.split(" | ");
            urls.forEach(url => {
                if (url) {
                    const img = document.createElement('img');
                    img.src = url;
                    img.onclick = () => window.open(url, '_blank');
                    imageGrid.appendChild(img);
                }
            });
        }

        // Feedback State
        const fb = feedbackData[item.url] || {};
        modalUseful.checked = fb.useful || false;
        modalNotes.value = fb.notes || "";

        modal.style.display = "block";
    }

    async function saveFeedback() {
        if (!currentItem) return;

        const feedback = {
            url: currentItem.url,
            useful: modalUseful.checked,
            notes: modalNotes.value,
            timestamp: new Date().toISOString()
        };

        try {
            await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(feedback)
            });
            
            // Update local state
            feedbackData[currentItem.url] = feedback;
            renderTable(searchInput.value);
            updateStats();
            
            // Optional: Close modal or show success
            // modal.style.display = "none";
            alert("Feedback saved!");
        } catch (err) {
            console.error("Error saving feedback:", err);
            alert("Failed to save feedback");
        }
    }
});
