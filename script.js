const DATABASE_URL = 'https://campus-find-it-default-rtdb.firebaseio.com';
const ITEMS_URL = `${DATABASE_URL}/items.json`;
const DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80';

const itemGrid = document.getElementById('itemGrid');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const typeFilter = document.getElementById('typeFilter');
const reportForm = document.getElementById('reportForm');
const toast = document.getElementById('toast');
const databaseStatus = document.getElementById('databaseStatus');
const photoInput = document.getElementById('photoUpload');

let items = [];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function setDatabaseStatus(message, state) {
  databaseStatus.textContent = message;
  databaseStatus.dataset.state = state;
}

async function loadItems() {
  const response = await fetch(ITEMS_URL);
  if (!response.ok) {
    throw new Error(`Database request failed (${response.status}).`);
  }

  const records = await response.json();
  items = records
    ? Object.entries(records).map(([id, item]) => ({ ...item, id }))
    : [];
  renderItems();
}

async function connectToDatabase() {
  try {
    await loadItems();
    setDatabaseStatus('Connected to live listings', 'connected');

    const stream = new EventSource(ITEMS_URL);
    stream.addEventListener('put', loadItems);
    stream.addEventListener('patch', loadItems);
    stream.addEventListener('error', () => {
      if (stream.readyState === EventSource.CLOSED) {
        setDatabaseStatus('Live updates unavailable; reconnecting…', 'error');
      }
    });
  } catch (error) {
    setDatabaseStatus('Could not connect to listings. Check database access and refresh.', 'error');
    showToast(error.message);
  }
}

function renderItems() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;
  const selectedType = typeFilter.value;

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm) ||
      item.location.toLowerCase().includes(searchTerm) ||
      item.description.toLowerCase().includes(searchTerm);

    const matchesCategory =
      selectedCategory === 'all' || item.category === selectedCategory;
    const matchesType = selectedType === 'all' || item.type === selectedType;

    return matchesSearch && matchesCategory && matchesType;
  });

  if (!filteredItems.length) {
    itemGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; background: #fff; border: 1px solid #dfe7f4; border-radius: 20px; padding: 30px; text-align: center; color: #6b7280;">
        No items match your search. Try adjusting the filters or report a new item.
      </div>
    `;
    return;
  }

  itemGrid.innerHTML = filteredItems
    .map(
      (item) => `
        <article class="item-card">
          <div class="item-image">
            <img class="item-photo" src="${escapeHtml(item.image || DEFAULT_IMAGE)}" alt="" />
            <span class="item-badge ${escapeHtml(item.type).toLowerCase()}">${escapeHtml(item.type)}</span>
          </div>
          <div class="item-content">
            <div class="meta-row">
              <span class="category-pill">${escapeHtml(item.category)}</span>
              <span class="item-date">${escapeHtml(item.date)}</span>
            </div>
            <h3>${escapeHtml(item.name)}</h3>
            <p>${escapeHtml(item.description)}</p>
            <div class="item-footer">
              <span class="location-tag">📍 ${escapeHtml(item.location)}</span>
              <button class="tiny-btn" type="button">Connect</button>
            </div>
          </div>
        </article>
      `,
    )
    .join('');
}

[searchInput, categoryFilter, typeFilter].forEach((element) => {
  element.addEventListener('input', renderItems);
  element.addEventListener('change', renderItems);
});

reportForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(reportForm);
  const name = formData.get('itemName').toString().trim();
  const category = document.getElementById('category').value;
  const type = document.getElementById('type').value;
  const location = document.getElementById('location').value.trim();
  const description = document.getElementById('description').value.trim();
  const contactName = document.getElementById('contactName').value.trim();
  const contactEmail = document.getElementById('contactEmail').value.trim();
  const hasPhoto = photoInput.files.length > 0;

  try {
    const response = await fetch(ITEMS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        category,
        type,
        location,
        description,
        contactName,
        contactEmail,
        date: new Date().toISOString(),
        image: DEFAULT_IMAGE,
      }),
    });

    if (!response.ok) {
      throw new Error(`Could not save listing (${response.status}).`);
    }

    reportForm.reset();
    await loadItems();
    showToast(
      hasPhoto
        ? 'Listing saved. Photo uploads need Firebase Storage.'
        : 'Your report has been saved successfully.',
    );
  } catch (error) {
    showToast(error.message);
  }
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');

  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

renderItems();
connectToDatabase();
