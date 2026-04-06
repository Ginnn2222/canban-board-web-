// ── ID Generator ─────────────────────────────────────────
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// ── State ────────────────────────────────────────────────
let boardData = [];

// ── API Helper ───────────────────────────────────────────
async function apiBoard(action, data = {}) {
    try {
        const res = await fetch('api/board.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...data })
        });
        const r = await res.json();
        if (!r.ok) throw new Error(r.message || 'API error');
        return r.data;
    } catch(e) {
        showToast('⚠ ' + (e.message || 'Koneksi gagal'));
        throw e;
    }
}

// ── Load Board from DB ───────────────────────────────────
async function loadBoard() {
    try {
        boardData = await apiBoard('get_board') || [];
        renderAllLists();
        if (landingPage)    landingPage.classList.add('hidden');
        if (boardContainer) boardContainer.classList.remove('hidden');
        document.body.classList.remove('home-view');
        
        // Start online presence system (heartbeat + avatar stack refresh)
        startPresenceSystem();
    } catch(e) {
        console.error('Failed to load board:', e);
    }
}

// ── Render Online Users (Board Members Stack) ──
const AVATAR_COLORS = ['#0984e3', '#00b894', '#e17055', '#6c5ce7', '#fdcb6e', '#00cec9', '#d63031', '#636e72'];

function getAvatarColor(userId) {
    return AVATAR_COLORS[userId % AVATAR_COLORS.length];
}

async function renderActiveUsersStack() {
    const stackContainer = document.getElementById('active-users-stack');
    if (!stackContainer) return;
    
    try {
        const res = await authApi({ action: 'get_all_users' });
        if (res.ok && res.data) {
            stackContainer.innerHTML = '';
            
            if (res.data.length === 0) {
                stackContainer.classList.add('hidden');
                return;
            }
            
            // Show max 5 users visually
            const displayUsers = res.data.slice(0, 5);
            displayUsers.forEach((u, i) => {
                const dv = document.createElement('div');
                dv.className = 'stack-avatar';
                dv.title = u.username + ' (online)';
                dv.style.zIndex = displayUsers.length - i;
                dv.style.background = getAvatarColor(u.id);
                
                if (u.photo) {
                    const img = document.createElement('img');
                    img.src = u.photo;
                    if (u.photoPos) {
                        img.style.objectPosition = `${u.photoPos.x}% ${u.photoPos.y}%`;
                    }
                    dv.appendChild(img);
                } else {
                    dv.textContent = getInitials(u.username);
                }
                
                // Green online dot
                const dot = document.createElement('span');
                dot.className = 'online-dot';
                dv.appendChild(dot);
                
                stackContainer.appendChild(dv);
            });
            
            if (res.data.length > 5) {
                const excess = document.createElement('div');
                excess.className = 'stack-avatar';
                excess.style.background = '#eee';
                excess.style.color = '#333';
                excess.style.zIndex = 0;
                excess.textContent = '+' + (res.data.length - 5);
                excess.title = `${res.data.length - 5} lainnya sedang online`;
                stackContainer.appendChild(excess);
            }
            
            stackContainer.classList.remove('hidden');
        }
    } catch(e) {
        console.error('Failed to load online users stack:', e);
    }
}

// ── Heartbeat Ping (Online Presence) ──
let _heartbeatInterval = null;
let _stackRefreshInterval = null;

function startPresenceSystem() {
    // Send initial ping immediately
    authApi({ action: 'ping' }).catch(() => {});
    
    // Heartbeat: ping every 60 seconds
    if (_heartbeatInterval) clearInterval(_heartbeatInterval);
    _heartbeatInterval = setInterval(() => {
        authApi({ action: 'ping' }).catch(() => {});
    }, 60000);
    
    // Refresh avatar stack every 15 seconds
    if (_stackRefreshInterval) clearInterval(_stackRefreshInterval);
    _stackRefreshInterval = setInterval(() => {
        renderActiveUsersStack();
    }, 15000);
}

function stopPresenceSystem() {
    if (_heartbeatInterval) { clearInterval(_heartbeatInterval); _heartbeatInterval = null; }
    if (_stackRefreshInterval) { clearInterval(_stackRefreshInterval); _stackRefreshInterval = null; }
    const sc = document.getElementById('active-users-stack');
    if (sc) { sc.innerHTML = ''; sc.classList.add('hidden'); }
}

// ── Elements ─────────────────────────────────────────────
const boardContainer = document.querySelector('.board-container');
const landingPage    = document.getElementById('landing-page');
const addListBtn     = document.getElementById('add-list-btn');
const listTemplate   = document.getElementById('list-template');
const cardTemplate   = document.getElementById('card-template');

// Modal Elements
const modalOverlay          = document.getElementById('card-modal');
const modalCloseBtn         = document.getElementById('modal-close-btn');
const modalCardTitle        = document.getElementById('modal-card-title');
const modalListName         = document.getElementById('modal-list-name');
const modalListNameText     = document.getElementById('modal-list-name-text');
const modalListNameDetail   = document.getElementById('modal-list-name-detail');
const modalDescriptionInput = document.getElementById('modal-description-input');
const modalSaveDescBtn      = document.getElementById('modal-save-desc-btn');
const modalCancelDescBtn    = document.getElementById('modal-cancel-desc-btn');
const descriptionActions    = document.querySelector('.description-actions');
const commentActions        = document.querySelector('.comment-actions');

// List Summary Elements
const summaryModal    = document.getElementById('list-summary-modal');
const summaryListName = document.getElementById('summary-list-name');
const summaryContent  = document.getElementById('summary-content');
const summaryCloseBtn = document.getElementById('summary-close-btn');
const summaryCopyBtn  = document.getElementById('summary-copy-btn');

let currentModalListId = null;
let currentModalCardId = null;

// ── Render Functions ─────────────────────────────────────
function renderList(listData) {
    const listClone = listTemplate.content.cloneNode(true);
    const listEl    = listClone.querySelector('.list');
    listEl.dataset.id = listData.id;

    const titleEl = listEl.querySelector('.list-title');
    titleEl.textContent = listData.title;

    titleEl.addEventListener('blur', e => {
        titleEl.contentEditable = 'false';
        titleEl.style.cursor  = 'default';
        titleEl.style.outline = 'none';
        updateListTitle(listData.id, e.target.textContent);
    });
    titleEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); } });

    // Kebab Menu
    const toggleBtn = listEl.querySelector('.list-kebab-toggle-btn');
    const dropdown  = listEl.querySelector('.list-kebab-dropdown');
    toggleBtn.addEventListener('click', e => { if (!e.target.closest('.list-dropdown-item')) dropdown.classList.toggle('hidden'); });
    document.addEventListener('click', e => { if (!toggleBtn.contains(e.target) && !dropdown.contains(e.target)) dropdown.classList.add('hidden'); });

    listEl.querySelector('.rename-list-action').addEventListener('click', () => {
        dropdown.classList.add('hidden');
        titleEl.contentEditable = 'true';
        titleEl.style.cursor  = 'text';
        titleEl.style.outline = '1px solid rgba(192,133,82,0.5)';
        titleEl.focus();
        requestAnimationFrame(() => document.execCommand('selectAll', false, null));
    });

    listEl.querySelector('.delete-list-action').addEventListener('click', () => {
        dropdown.classList.add('hidden');
        if (confirm('Hapus list ini beserta semua card di dalamnya?')) {
            deleteList(listData.id);
            listEl.style.transform = 'scale(0.9)';
            listEl.style.opacity   = '0';
            setTimeout(() => listEl.remove(), 200);
        }
    });

    listEl.querySelector('.add-card-btn').addEventListener('click', () => addCard(listData.id));

    const summaryBtn = listEl.querySelector('.list-summary-btn');
    if (summaryBtn) summaryBtn.addEventListener('click', () => openListSummary(listData.id));

    const cardsContainer = listEl.querySelector('.cards-container');
    listData.cards.forEach(cardData => cardsContainer.appendChild(createCardElement(cardData, listData.id)));

    setupListDragAndDrop(listEl, listData.id);
    boardContainer.appendChild(listEl);
}

function createCardElement(cardData, listId) {
    const cardClone = cardTemplate.content.cloneNode(true);
    const cardEl    = cardClone.querySelector('.card');
    cardEl.dataset.id = cardData.id;

    cardEl.querySelector('.card-text').textContent = cardData.text;

    const labelsEl = cardEl.querySelector('.card-labels');
    if (cardData.labels && cardData.labels.length > 0) {
        labelsEl.innerHTML = cardData.labels.map(l =>
            `<span class="label-chip" style="background:${l.color}" title="${l.name}">${l.name || '&nbsp;'}</span>`
        ).join('');
        labelsEl.classList.remove('hidden');
    } else {
        labelsEl.classList.add('hidden');
    }

    const badgesEl = cardEl.querySelector('.card-badges');
    let badgesHtml = '';
    if (cardData.description && cardData.description.trim())
        badgesHtml += `<div class="card-badge" title="Has description"><i class="fa-solid fa-align-left"></i></div>`;
    
    // 🔥 Use counts from API instead of array length 🔥
    if (cardData.comment_count > 0) {
        badgesHtml += `<div class="card-badge" title="${cardData.comment_count} comments"><i class="fa-regular fa-comment"></i> ${cardData.comment_count}</div>`;
    }
    if (cardData.attachment_count > 0) {
        badgesHtml += `<div class="card-badge" title="${cardData.attachment_count} attachments"><i class="fa-solid fa-paperclip"></i> ${cardData.attachment_count}</div>`;
    }

    if (badgesHtml) { badgesEl.innerHTML = badgesHtml; badgesEl.classList.remove('hidden'); }
    else badgesEl.classList.add('hidden');

    cardEl.addEventListener('click', () => openModal(listId, cardData.id));
    setupCardDragAndDrop(cardEl, cardData.id, listId);
    return cardEl;
}

function renderAllLists() {
    boardContainer.innerHTML = '';
    boardData.forEach(list => renderList(list));
}

// ── Logic Functions ───────────────────────────────────────
async function addList() {
    const newList = { id: generateId(), title: 'New List', cards: [] };
    boardData.push(newList);
    renderList(newList);
    boardContainer.scrollTo({ left: boardContainer.scrollWidth, behavior: 'smooth' });
    try { await apiBoard('add_list', { id: newList.id, title: newList.title, position: boardData.length - 1 }); }
    catch(e) { boardData.pop(); renderAllLists(); }
}

async function updateListTitle(listId, newTitle) {
    const list = boardData.find(l => l.id === listId);
    if (!list) return;
    const old = list.title;
    list.title = newTitle.trim() || 'Untitled List';
    try { await apiBoard('update_list', { id: listId, title: list.title }); }
    catch(e) { list.title = old; }
}

async function deleteList(listId) {
    boardData = boardData.filter(l => l.id !== listId);
    try { await apiBoard('delete_list', { id: listId }); }
    catch(e) { /* already removed from DOM – reload to resync */ loadBoard(); }
}

async function addCard(listId) {
    const list = boardData.find(l => l.id === listId);
    if (!list) return;
    const newCard = { id: generateId(), text: 'New task...', description: '', labels: [], comments: [] };
    list.cards.push(newCard);

    const listEl = document.querySelector(`.list[data-id="${listId}"]`);
    if (listEl) {
        const cc = listEl.querySelector('.cards-container');
        cc.appendChild(createCardElement(newCard, listId));
        cc.scrollTop = cc.scrollHeight;
    }
    try { await apiBoard('add_card', { id: newCard.id, list_id: listId, text: newCard.text, description: '', position: list.cards.length - 1 }); }
    catch(e) { list.cards = list.cards.filter(c => c.id !== newCard.id); renderAllLists(); }
}

async function updateCardText(listId, cardId, newText) {
    const list = boardData.find(l => l.id === listId);
    if (!list) return;
    const card = list.cards.find(c => c.id === cardId);
    if (!card) return;
    const old = card.text;
    card.text = newText.trim() || 'Empty task';
    try { await apiBoard('update_card', { id: cardId, text: card.text }); }
    catch(e) { card.text = old; }
}

async function deleteCard(listId, cardId) {
    const list = boardData.find(l => l.id === listId);
    if (!list) return;
    list.cards = list.cards.filter(c => c.id !== cardId);
    try { await apiBoard('delete_card', { id: cardId }); }
    catch(e) { loadBoard(); }
}

// ── Sync positions to DB (drag-drop) ─────────────────────
async function syncPositions() {
    try {
        await apiBoard('sync_positions', {
            lists: boardData.map((l, li) => ({
                id: l.id, position: li,
                cards: l.cards.map((c, ci) => ({ id: c.id, position: ci }))
            }))
        });
    } catch(e) { /* non-critical */ }
}

// ── Modal Logic ───────────────────────────────────────────
function openModal(listId, cardId) {
    const list = boardData.find(l => l.id === listId);
    if (!list) return;
    const card = list.cards.find(c => c.id === cardId);
    if (!card) return;

    currentModalListId = listId;
    currentModalCardId = cardId;

    modalCardTitle.textContent     = card.text;
    modalCardTitle.contentEditable = 'false';
    modalCardTitle.style.cursor    = 'default';
    if (modalListNameText)   modalListNameText.textContent   = list.title;
    if (modalListNameDetail) modalListNameDetail.textContent = list.title;
    modalListName.contentEditable = 'false';
    modalListName.style.outline   = 'none';
    modalDescriptionInput.value   = card.description || '';

    // Optimize Loading: Instantly render known state if available
    const cList = document.getElementById('modal-comments-list');
    const aListContainer = document.getElementById('modal-attachments-section');
    
    if (card.comments === undefined) {
        // Only show spinner on very first load
        if (cList) cList.innerHTML = '<div style="padding:1rem;color:#888;text-align:center;font-size:0.85rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
        if (aListContainer) aListContainer.classList.add('hidden');
    } else {
        // Render instantly from memory
        renderComments(listId, cardId);
        renderAttachments(listId, cardId);
    }

    // 🔥 Lazy Loading: Silently sync from server 🔥
    (async () => {
        try {
            const data = await apiBoard('get_card_details', { card_id: cardId });
            card.comments = data.comments || [];
            // Re-render automatically to apply any new background data
            renderComments(listId, cardId);
            renderAttachments(listId, cardId);
        } catch (e) {
            console.error("Failed to load card details", e);
            if (card.comments === undefined) {
                if (cList) cList.innerHTML = ''; // Clear spinner on fail
                card.comments = [];
                renderComments(listId, cardId);
                renderAttachments(listId, cardId);
            }
        }
    })();

    const currentUser = getCurrentUser();
    const avatarEl = document.getElementById('comment-author-avatar');
    if (avatarEl) {
        if (currentUser && currentUser.photo) {
            avatarEl.style.backgroundImage = `url(${currentUser.photo})`;
            avatarEl.style.backgroundSize  = 'cover';
            avatarEl.style.backgroundPosition = 'center';
            avatarEl.textContent = '';
        } else if (currentUser) {
            avatarEl.style.backgroundImage = '';
            avatarEl.textContent = currentUser.username.charAt(0).toUpperCase();
        } else {
            avatarEl.style.backgroundImage = '';
            avatarEl.textContent = 'G';
        }
    }

    document.getElementById('modal-comment-input').innerHTML = '';
    currentCommentAttachments = [];
    updateCommentAttachmentsPreview();
    if (descriptionActions) descriptionActions.classList.add('hidden');
    if (commentActions)     commentActions.classList.add('hidden');
    const ct = document.querySelector('.comment-toolbar');
    if (ct) ct.classList.add('hidden');
    renderModalLabels(card);
    modalOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modalOverlay.classList.add('hidden');
    document.body.style.overflow = '';
    currentModalListId = null;
    currentModalCardId = null;
}

modalCloseBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

if (modalListNameText) {
    modalListNameText.addEventListener('blur', e => {
        modalListNameText.contentEditable = 'false';
        modalListNameText.style.background = 'none';
        if (!currentModalListId) return;
        const newName = e.target.textContent.trim() || 'Untitled List';
        const list = boardData.find(l => l.id === currentModalListId);
        if (list && list.title !== newName) {
            list.title = newName;
            apiBoard('update_list', { id: currentModalListId, title: newName });
            const listTitleEl = document.querySelector(`.list[data-id="${currentModalListId}"] .list-title`);
            if (listTitleEl) listTitleEl.textContent = newName;
            if (modalListNameDetail) modalListNameDetail.textContent = newName;
        }
    });
    modalListNameText.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); modalListNameText.blur(); } });
}

// Kebab menu
const kebabBtn      = document.getElementById('modal-kebab-btn');
const kebabDropdown = document.getElementById('modal-kebab-dropdown');
if (kebabBtn && kebabDropdown) {
    kebabBtn.addEventListener('click', e => { if (!e.target.closest('.list-dropdown-item')) kebabDropdown.classList.toggle('hidden'); });
    document.addEventListener('click', e => { if (!kebabBtn.contains(e.target) && !kebabDropdown.contains(e.target)) kebabDropdown.classList.add('hidden'); });
    const btnRenameList = document.getElementById('kebab-rename-list-btn');
    if (btnRenameList) {
        btnRenameList.addEventListener('click', () => {
            kebabDropdown.classList.add('hidden');
            if (modalListNameText) {
                modalListNameText.contentEditable = 'true';
                modalListNameText.style.background = 'rgba(255,255,255,0.1)';
                modalListNameText.focus();
                requestAnimationFrame(() => document.execCommand('selectAll', false, null));
            }
        });
    }
    const btnRenameCard = document.getElementById('kebab-rename-card-btn');
    if (btnRenameCard) {
        btnRenameCard.addEventListener('click', () => {
            kebabDropdown.classList.add('hidden');
            modalCardTitle.contentEditable = 'true';
            modalCardTitle.style.cursor = 'text';
            modalCardTitle.focus();
            requestAnimationFrame(() => document.execCommand('selectAll', false, null));
        });
    }
}

// Description actions
if (modalDescriptionInput && descriptionActions)
    modalDescriptionInput.addEventListener('focus', () => descriptionActions.classList.remove('hidden'));

const globalCommentInput = document.getElementById('modal-comment-input');
if (globalCommentInput && commentActions) {
    globalCommentInput.addEventListener('focus', () => {
        commentActions.classList.remove('hidden');
        const ct = document.querySelector('.comment-toolbar');
        if (ct) ct.classList.remove('hidden');
    });
}

document.addEventListener('click', e => {
    const wrapper = document.querySelector('.comment-input-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
        if (globalCommentInput && globalCommentInput.innerHTML.trim() === '' && !currentCommentAttachments.length) {
            commentActions.classList.add('hidden');
            const ct = document.querySelector('.comment-toolbar');
            if (ct) ct.classList.add('hidden');
            globalCommentInput.innerHTML = '';
        }
    }
});

modalCardTitle.addEventListener('blur', e => {
    modalCardTitle.contentEditable = 'false';
    modalCardTitle.style.cursor    = 'default';
    if (!currentModalListId || !currentModalCardId) return;
    const newText = e.target.textContent.trim() || 'Empty task';
    updateCardText(currentModalListId, currentModalCardId, newText);
    const cardEl = document.querySelector(`.list[data-id="${currentModalListId}"] .card[data-id="${currentModalCardId}"]`);
    if (cardEl) cardEl.querySelector('.card-text').textContent = newText;
});
modalCardTitle.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); modalCardTitle.blur(); } });

modalSaveDescBtn.addEventListener('click', async () => {
    if (!currentModalListId || !currentModalCardId) return;
    const list = boardData.find(l => l.id === currentModalListId);
    if (!list) return;
    const card = list.cards.find(c => c.id === currentModalCardId);
    if (!card) return;
    card.description = modalDescriptionInput.value;
    try {
        await apiBoard('update_card', { id: card.id, description: card.description });
        showToast('Deskripsi berhasil disimpan');
        if (descriptionActions) descriptionActions.classList.add('hidden');
        updateCardBadgesOnBoard(currentModalListId, currentModalCardId);
    } catch(e) { /* toast shown by apiBoard */ }
});

modalCancelDescBtn.addEventListener('click', () => {
    if (!currentModalListId || !currentModalCardId) return;
    const list = boardData.find(l => l.id === currentModalListId);
    if (list) {
        const card = list.cards.find(c => c.id === currentModalCardId);
        if (card) modalDescriptionInput.value = card.description || '';
    }
    if (descriptionActions) descriptionActions.classList.add('hidden');
});

const kebabDeleteBtn = document.getElementById('kebab-delete-btn');
if (kebabDeleteBtn) {
    kebabDeleteBtn.addEventListener('click', () => {
        if (!currentModalListId || !currentModalCardId) return;
        if (confirm('Hapus card ini?')) {
            deleteCard(currentModalListId, currentModalCardId);
            const cardEl = document.querySelector(`.list[data-id="${currentModalListId}"] .card[data-id="${currentModalCardId}"]`);
            if (cardEl) { cardEl.style.transform = 'scale(0.9)'; cardEl.style.opacity = '0'; setTimeout(() => cardEl.remove(), 200); }
            closeModal();
            const kd = document.getElementById('modal-kebab-dropdown');
            if (kd) kd.classList.add('hidden');
        }
    });
}

// ── Drag and Drop ─────────────────────────────────────────
let draggedCardEl           = null;
let currentListIdDuringDrag = null;

function setupCardDragAndDrop(cardEl, cardId, listId) {
    cardEl.addEventListener('dragstart', () => {
        draggedCardEl = cardEl;
        currentListIdDuringDrag = listId;
        setTimeout(() => cardEl.classList.add('dragging'), 0);
    });
    cardEl.addEventListener('dragend', () => {
        cardEl.classList.remove('dragging');
        draggedCardEl = null;
        currentListIdDuringDrag = null;
    });
}

function setupListDragAndDrop(listEl, targetListId) {
    const cardsContainer = listEl.querySelector('.cards-container');
    listEl.addEventListener('dragover', e => {
        e.preventDefault();
        listEl.classList.add('drag-over');
        if (!draggedCardEl) return;
        const afterElement = getDragAfterElement(cardsContainer, e.clientY);
        afterElement == null ? cardsContainer.appendChild(draggedCardEl) : cardsContainer.insertBefore(draggedCardEl, afterElement);
    });
    listEl.addEventListener('dragleave', () => listEl.classList.remove('drag-over'));
    listEl.addEventListener('drop', e => {
        e.preventDefault();
        listEl.classList.remove('drag-over');
        if (!draggedCardEl) return;
        const cardId = draggedCardEl.dataset.id;

        if (currentListIdDuringDrag !== targetListId) {
            const sourceList = boardData.find(l => l.id === currentListIdDuringDrag);
            const targetList = boardData.find(l => l.id === targetListId);
            const cardIdx    = sourceList.cards.findIndex(c => c.id === cardId);
            if (cardIdx === -1) return;
            const cardData = sourceList.cards.splice(cardIdx, 1)[0];
            setTimeout(() => {
                const domCards    = cardsContainer.querySelectorAll('.card');
                const newCardsArr = [];
                domCards.forEach(cEl => {
                    const cId   = cEl.dataset.id;
                    let cData   = targetList.cards.find(c => c.id === cId);
                    if (cId === cardId) cData = cardData;
                    if (cData) newCardsArr.push(cData);
                });
                targetList.cards = newCardsArr;
                const newCardEl  = createCardElement(cardData, targetListId);
                cardsContainer.replaceChild(newCardEl, draggedCardEl);
                syncPositions();
            }, 0);
        } else {
            const list = boardData.find(l => l.id === targetListId);
            setTimeout(() => {
                const domCards    = cardsContainer.querySelectorAll('.card');
                const newCardsArr = [];
                domCards.forEach(cEl => {
                    const cData = list.cards.find(c => c.id === cEl.dataset.id);
                    if (cData) newCardsArr.push(cData);
                });
                list.cards = newCardsArr;
                syncPositions();
            }, 0);
        }
    });
}

function getDragAfterElement(container, y) {
    return [...container.querySelectorAll('.card:not(.dragging)')].reduce((closest, child) => {
        const offset = y - child.getBoundingClientRect().top - child.getBoundingClientRect().height / 2;
        return (offset < 0 && offset > closest.offset) ? { offset, element: child } : closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

addListBtn.addEventListener('click', addList);

// ── Toast Helper ──────────────────────────────────────────
let toastTimer = null;
function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    clearTimeout(toastTimer);
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${message}`;
    document.body.appendChild(toast);
    toastTimer = setTimeout(() => { toast.classList.add('hiding'); setTimeout(() => toast.remove(), 260); }, 2500);
}

// ── Search Logic ──────────────────────────────────────────
const searchInput       = document.getElementById('search-input');
const searchClear       = document.getElementById('search-clear');
const searchDropdown    = document.getElementById('search-dropdown');
const searchResultsList = document.getElementById('search-results-list');

function renderSearchResults(query) {
    const q = query.trim().toLowerCase();
    searchResultsList.innerHTML = '';
    if (!q) { searchDropdown.classList.add('hidden'); return; }
    let html = '', count = 0;
    boardData.forEach(list => {
        list.cards.forEach(card => {
            if (card.text.toLowerCase().includes(q) || (card.description && card.description.toLowerCase().includes(q))) {
                count++;
                html += `<div class="search-result-item" onclick="openModal('${list.id}','${card.id}');document.getElementById('search-dropdown').classList.add('hidden')">
                    <i class="fa-solid fa-window-maximize search-result-icon"></i>
                    <div class="search-result-content">
                        <span class="search-result-title">${card.text}</span>
                        <span class="search-result-listname">${list.title}</span>
                    </div></div>`;
            }
        });
    });
    if (!count) html = `<div class="search-no-results">Tidak ada hasil untuk "${query}"</div>`;
    searchResultsList.innerHTML = html;
    searchDropdown.classList.remove('hidden');
}

searchInput.addEventListener('input', e => { searchClear.classList.toggle('hidden', e.target.value === ''); renderSearchResults(e.target.value); });
searchClear.addEventListener('click', () => { searchInput.value = ''; searchClear.classList.add('hidden'); renderSearchResults(''); searchInput.focus(); });
document.addEventListener('click', e => { if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) searchDropdown.classList.add('hidden'); });
searchInput.addEventListener('focus', () => { if (searchInput.value.trim()) searchDropdown.classList.remove('hidden'); });

// ── Comments & Activity ───────────────────────────────────
const modalCommentInput   = document.getElementById('modal-comment-input');
const commentFileInput    = document.getElementById('comment-file-input');
const modalSaveCommentBtn = document.getElementById('modal-save-comment-btn');
const modalCommentsList   = document.getElementById('modal-comments-list');

let currentCommentAttachments = [];

modalCommentsList.addEventListener('click', async e => {
    const deleteBtn = e.target.closest('.delete-comment-btn');
    if (deleteBtn) {
        if (!confirm('Hapus komentar ini?')) return;
        const commentId = deleteBtn.dataset.commentId;
        const list = boardData.find(l => l.id === currentModalListId);
        if (!list) return;
        const card = list.cards.find(c => c.id === currentModalCardId);
        if (!card) return;
        try {
            await apiBoard('delete_comment', { id: commentId });
            card.comments = card.comments.filter(c => c.id !== commentId);
            renderComments(currentModalListId, currentModalCardId);
            renderAttachments(currentModalListId, currentModalCardId);
            updateCardBadgesOnBoard(currentModalListId, currentModalCardId);
        } catch(e) { /* toast shown */ }
        return;
    }

    const editBtn = e.target.closest('.edit-comment-btn');
    if (editBtn) {
        const commentId = editBtn.dataset.commentId;
        const list = boardData.find(l => l.id === currentModalListId);
        if (!list) return;
        const card = list.cards.find(c => c.id === currentModalCardId);
        if (!card) return;
        const cmt = card.comments.find(c => c.id === commentId);
        if(!cmt) return;

        const commentItem = editBtn.closest('.comment-item');
        let bodyEl = commentItem.querySelector('.comment-item-body');
        if (!bodyEl) {
            bodyEl = document.createElement('div');
            bodyEl.className = 'comment-item-body';
            commentItem.querySelector('.comment-item-content').insertBefore(bodyEl, commentItem.querySelector('.comment-item-content > div:last-child'));
        }

        let existingText = cmt.text || '';
        let encodedText = existingText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        bodyEl.innerHTML = `
            <textarea class="edit-comment-textarea" style="width:100%; min-height:60px; padding:0.5rem; border:1px solid rgba(0,0,0,0.1); border-radius:4px; font-family:inherit; margin-top:0.5rem; resize:vertical;">${encodedText}</textarea>
            <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
                <button class="save-edit-btn" style="background:var(--accent-color); color:#fff; border:none; padding:0.3rem 0.8rem; border-radius:4px; cursor:pointer; font-size:0.8rem; font-weight:500;">Save</button>
                <button class="cancel-edit-btn" style="background:#f1f1f1; color:#333; border:none; padding:0.3rem 0.8rem; border-radius:4px; cursor:pointer; font-size:0.8rem; font-weight:500;">Cancel</button>
            </div>
        `;
        
        const headerActions = commentItem.querySelector('.comment-item-header .comment-actions-wrapper');
        if(headerActions) headerActions.style.display = 'none';

        return;
    }

    const saveEditBtn = e.target.closest('.save-edit-btn');
    if (saveEditBtn) {
        const commentItem = saveEditBtn.closest('.comment-item');
        const textarea = commentItem.querySelector('.edit-comment-textarea');
        const editBtnNode = commentItem.querySelector('.edit-comment-btn') || commentItem.querySelector('[data-comment-id]');
        if(!editBtnNode) return;
        const commentId = editBtnNode.dataset.commentId || commentItem.dataset.id;
        const list = boardData.find(l => l.id === currentModalListId);
        const card = list.cards.find(c => c.id === currentModalCardId);
        const cmt = card.comments.find(c => c.id === commentId);
        
        const newText = textarea.value.trim();
        saveEditBtn.disabled = true;
        saveEditBtn.textContent = '...';
        try {
            await apiBoard('edit_comment', { id: commentId, text: newText });
            cmt.text = newText;
            renderComments(currentModalListId, currentModalCardId);
        } catch(e) {
            saveEditBtn.disabled = false;
            saveEditBtn.textContent = 'Save';
        }
        return;
    }

    const cancelEditBtn = e.target.closest('.cancel-edit-btn');
    if (cancelEditBtn) {
        renderComments(currentModalListId, currentModalCardId);
        return;
    }
    const trigger = e.target.closest('.preview-trigger');
    if (trigger) {
        const commentId = trigger.dataset.commentId;
        const attIdx    = parseInt(trigger.dataset.attIdx);
        const list = boardData.find(l => l.id === currentModalListId);
        if (!list) return;
        const card = list.cards.find(c => c.id === currentModalCardId);
        if (!card) return;
        const cmt  = card.comments.find(c => c.id === commentId);
        if (!cmt) return;
        const attachments = cmt.attachments || [];
        const att = isNaN(attIdx) ? attachments[0] : attachments[attIdx];
        if (att) openAttachmentPreviewModal(att);
    }
});

function openAttachmentPreviewModal(attachment) {
    const previewModal   = document.getElementById('attachment-preview-modal');
    const previewTitle   = document.getElementById('preview-modal-title');
    const previewContent = document.getElementById('preview-modal-content');
    const downloadBtn    = document.getElementById('preview-download-btn');
    previewTitle.textContent = attachment.name;
    downloadBtn.onclick = () => { const a = document.createElement('a'); a.href = attachment.data; a.download = attachment.name; a.click(); };
    if (attachment.isImage) {
        previewContent.innerHTML = `<img src="${attachment.data}" style="max-width:100%;max-height:100%;object-fit:contain;display:block;margin:0 auto;border-radius:4px;">`;
    } else if (attachment.name.toLowerCase().endsWith('.pdf') || (attachment.data && attachment.data.startsWith('data:application/pdf'))) {
        previewContent.innerHTML = `<iframe src="${attachment.data}" style="width:100%;height:100%;border:none;"></iframe>`;
    } else {
        previewContent.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px"><i class="fa-solid fa-file-lines fa-4x" style="margin-bottom:1rem;color:#4B2E2B"></i><p style="color:#4B2E2B;font-weight:500">Preview tidak tersedia — silakan download file.</p></div>`;
    }
    previewModal.style.display = 'flex';
    previewModal.classList.remove('hidden');
}

document.body.addEventListener('click', e => {
    if (e.target.closest('#preview-close-btn')) {
        const pm = document.getElementById('attachment-preview-modal');
        if (pm) { pm.classList.add('hidden'); pm.style.display = ''; }
    }
});

function updateCommentAttachmentsPreview() {
    const container = document.getElementById('comment-attachments-container');
    if (!container) return;
    if (!currentCommentAttachments.length) { container.classList.add('hidden'); container.innerHTML = ''; return; }
    container.classList.remove('hidden');
    container.innerHTML = currentCommentAttachments.map((att, i) =>
        `<div class="comment-attachment-chip">
            <i class="fa-solid ${att.isImage ? 'fa-image' : 'fa-file'}"></i>
            <span>${att.name}</span>
            <button class="remove-chip-btn" onclick="removeCommentAttachment(${i})"><i class="fa-solid fa-xmark"></i></button>
        </div>`
    ).join('');
}
window.removeCommentAttachment = function(i) { currentCommentAttachments.splice(i, 1); updateCommentAttachmentsPreview(); };

commentFileInput.addEventListener('change', async e => {
    for (const file of Array.from(e.target.files)) {
        if (file.size > 10 * 1024 * 1024) { showToast(`File ${file.name} melebihi 10MB!`); continue; }
        const dataUrl = await new Promise(resolve => { const r = new FileReader(); r.onload = ev => resolve(ev.target.result); r.readAsDataURL(file); });
        currentCommentAttachments.push({ name: file.name, data: dataUrl, isImage: file.type.startsWith('image/') });
    }
    updateCommentAttachmentsPreview();
    e.target.value = '';
});

modalSaveCommentBtn.addEventListener('click', async () => {
    if (!currentModalListId || !currentModalCardId) return;
    const text = modalCommentInput.innerHTML.trim();
    if ((!text || text === '<br>') && !currentCommentAttachments.length) return;

    const list = boardData.find(l => l.id === currentModalListId);
    if (!list) return;
    const card = list.cards.find(c => c.id === currentModalCardId);
    if (!card) return;

    const currentUser = getCurrentUser() || { username: 'Guest' };
    const commentId   = 'cmt-' + Date.now();
    const timestamp   = Date.now();

    try {
        const saved = await apiBoard('add_comment', {
            id: commentId, card_id: card.id,
            author_name: currentUser.username,
            text, attachments: currentCommentAttachments, timestamp
        });

        if (!card.comments) card.comments = [];
        card.comments.unshift(saved);
        currentCommentAttachments = [];
        updateCommentAttachmentsPreview();
        modalCommentInput.innerHTML = '';
        if (commentActions) commentActions.classList.add('hidden');
        const ct = document.querySelector('.comment-toolbar');
        if (ct) ct.classList.add('hidden');
        renderComments(currentModalListId, currentModalCardId);
        renderAttachments(currentModalListId, currentModalCardId);
        updateCardBadgesOnBoard(currentModalListId, currentModalCardId);
        showToast('Komentar ditambahkan!');
    } catch(e) { /* toast shown by apiBoard */ }
});

function updateCardBadgesOnBoard(listId, cardId) {
    const list = boardData.find(l => l.id === listId);
    if (!list) return;
    const card = list.cards.find(c => c.id === cardId);
    if (!card) return;
    const listEl = document.querySelector(`.list[data-id="${listId}"]`);
    if (!listEl) return;
    const cardEl = listEl.querySelector(`.card[data-id="${cardId}"]`);
    if (!cardEl) return;

    const labelsEl = cardEl.querySelector('.card-labels');
    if (card.labels && card.labels.length > 0) {
        labelsEl.innerHTML = card.labels.map(l => `<span class="label-chip" style="background:${l.color}" title="${l.name}">${l.name || '&nbsp;'}</span>`).join('');
        labelsEl.classList.remove('hidden');
    } else labelsEl.classList.add('hidden');

    const badgesEl = cardEl.querySelector('.card-badges');
    let bHtml = '';
    if (card.description && card.description.trim()) bHtml += `<div class="card-badge"><i class="fa-solid fa-align-left"></i></div>`;
    
    // Use counts or actual data if loaded
    const cCount = card.comment_count !== undefined ? card.comment_count : (card.comments ? card.comments.length : 0);
    const aCount = card.attachment_count !== undefined ? card.attachment_count : 0; // Simplified for badges

    if (cCount > 0) bHtml += `<div class="card-badge"><i class="fa-regular fa-comment"></i> ${cCount}</div>`;
    if (aCount > 0) bHtml += `<div class="card-badge"><i class="fa-solid fa-paperclip"></i> ${aCount}</div>`;
    
    if (bHtml) { badgesEl.innerHTML = bHtml; badgesEl.classList.remove('hidden'); } else badgesEl.classList.add('hidden');
}

function renderComments(listId, cardId) {
    if (!modalCommentsList) return;
    modalCommentsList.innerHTML = '';
    const list = boardData.find(l => l.id === listId);
    if (!list) return;
    const card = list.cards.find(c => c.id === cardId);
    if (!card || !card.comments || !card.comments.length) return;

    let html = '';
    card.comments.forEach(cmt => {
        const dateStr = new Date(cmt.timestamp).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
        let avatarHtml = cmt.authorPhoto
            ? `<div class="comment-item-avatar" style="background-image:url(${cmt.authorPhoto})"></div>`
            : `<div class="comment-item-avatar">${(cmt.authorName || 'G').charAt(0).toUpperCase()}</div>`;

        let attachHtml = '';
        (cmt.attachments || []).forEach((att, idx) => {
            attachHtml += att.isImage
                ? `<div class="comment-item-attachment preview-trigger" data-comment-id="${cmt.id}" data-att-idx="${idx}" style="cursor:pointer"><img src="${att.data}" alt="Attachment"></div>`
                : `<div class="comment-item-attachment preview-trigger" data-comment-id="${cmt.id}" data-att-idx="${idx}" style="padding:.6rem;background:rgba(0,0,0,.03);border-radius:4px;display:inline-flex;align-items:center;gap:.5rem;cursor:pointer"><i class="fa-solid fa-file" style="color:#4B2E2B"></i><span style="font-weight:500;color:#4B2E2B;font-size:.85rem">${att.name}</span></div>`;
        });
        if (attachHtml) attachHtml = `<div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.5rem">${attachHtml}</div>`;

        const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        const currentUserId = currentUser ? currentUser.id : null;
        const isAuthor = currentUserId && cmt.user_id === currentUserId;
        
        let actionsHtml = '';
        if (isAuthor) {
            actionsHtml = `
                <div class="comment-actions-wrapper" style="margin-left:auto; display:flex; gap:0.6rem; align-items:center;">
                    <button class="edit-comment-btn" data-comment-id="${cmt.id}" title="Edit Comment" style="background:none;border:none;color:#999;font-size:0.85rem;cursor:pointer;padding:0.2rem;transition:color 0.2s"><i class="fa-solid fa-pen"></i></button>
                    <button class="delete-comment-btn" data-comment-id="${cmt.id}" title="Delete Comment" style="background:none;border:none;color:#f87171;font-size:0.85rem;cursor:pointer;padding:0.2rem;transition:color 0.2s"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `;
        }

        html += `<div class="comment-item" data-id="${cmt.id}">
            ${avatarHtml}
            <div class="comment-item-content" style="width:100%">
                <div class="comment-item-header" style="display:flex;align-items:center;">
                    <span class="comment-item-name">${cmt.authorName || 'User'}</span>
                    <span class="comment-item-time" style="margin-left:.6rem">${dateStr}</span>
                    ${actionsHtml}
                </div>
                ${cmt.text ? `<div class="comment-item-body">${cmt.text}</div>` : ''}
                ${attachHtml}
            </div></div>`;
    });
    modalCommentsList.innerHTML = html;
}

// ── Rich Text Formatting ──────────────────────────────────
const btnFormatTitle   = document.getElementById('btn-format-title');
const btnFormatBold    = document.getElementById('btn-format-bold');
const btnFormatItalic  = document.getElementById('btn-format-italic');
const btnFormatList    = document.getElementById('btn-format-list');
const formatListDropdown = document.getElementById('format-list-dropdown');
const commentToolbar   = document.querySelector('.comment-toolbar');

if (commentToolbar) {
    commentToolbar.addEventListener('mousedown', e => {
        if (!e.target.closest('label[for="comment-file-input"]')) e.preventDefault();
    });
}
function execFormatCmd(cmd, value = null) { document.execCommand(cmd, false, value); modalCommentInput.focus(); }
if (btnFormatTitle)  btnFormatTitle.addEventListener('click', () => execFormatCmd('formatBlock', 'H3'));
if (btnFormatBold)   btnFormatBold.addEventListener('click', () => execFormatCmd('bold'));
if (btnFormatItalic) btnFormatItalic.addEventListener('click', () => execFormatCmd('italic'));
if (btnFormatList) {
    btnFormatList.addEventListener('click', e => { e.stopPropagation(); formatListDropdown.classList.toggle('hidden'); });
}
if (formatListDropdown) {
    formatListDropdown.addEventListener('click', e => {
        const item = e.target.closest('.list-dropdown-item');
        if (item) { execFormatCmd(item.dataset.cmd); formatListDropdown.classList.add('hidden'); }
    });
}
document.addEventListener('click', e => {
    if (formatListDropdown && !formatListDropdown.contains(e.target) && e.target !== btnFormatList && !btnFormatList?.contains(e.target))
        formatListDropdown.classList.add('hidden');
});

// ── Labels Logic ──────────────────────────────────────────
const PRESET_COLORS = ['#27ae60','#2980b9','#8e44ad','#f39c12','#d35400','#c0392b','#16a085','#34495e'];
let currentEditingLabelId = null;

const modalLabelsDisplay = document.getElementById('modal-labels-display');
const modalAddLabelBtn   = document.getElementById('modal-add-label-btn');
const labelEditor        = document.getElementById('label-editor');
const labelEditorClose   = document.getElementById('label-editor-close');
const labelNameInput     = document.getElementById('label-name-input');
const labelColorPalette  = document.getElementById('label-color-palette');
const labelCustomColor   = document.getElementById('label-custom-color');
const labelSaveBtn       = document.getElementById('label-save-btn');
const labelDeleteBtn     = document.getElementById('label-delete-btn');

function renderModalLabels(card) {
    if (!modalLabelsDisplay) return;
    if (!card.labels) card.labels = [];
    modalLabelsDisplay.innerHTML = card.labels.map(l =>
        `<span class="label-chip" style="background:${l.color}" onclick="openLabelEditor('${l.id}')">${l.name || '&nbsp;'}</span>`
    ).join('');
}

window.openLabelEditor = function(labelId) {
    if (!currentModalListId || !currentModalCardId) return;
    const list = boardData.find(l => l.id === currentModalListId);
    const card = list.cards.find(c => c.id === currentModalCardId);
    if (!card) return;
    currentEditingLabelId = labelId || null;
    if (labelId) {
        const lbl = card.labels.find(l => l.id === labelId);
        if (lbl) { labelNameInput.value = lbl.name || ''; labelCustomColor.value = lbl.color || '#4A90E2'; labelDeleteBtn.style.display = 'inline-block'; }
    } else {
        labelNameInput.value = ''; labelCustomColor.value = PRESET_COLORS[0]; labelDeleteBtn.style.display = 'none';
    }
    labelColorPalette.innerHTML = PRESET_COLORS.map(c =>
        `<div class="color-swatch" style="background:${c}" onclick="document.getElementById('label-custom-color').value='${c}'"></div>`
    ).join('');
    labelEditor.classList.remove('hidden');
};

function closeLabelEditor() { if (labelEditor) labelEditor.classList.add('hidden'); currentEditingLabelId = null; }
if (modalAddLabelBtn) modalAddLabelBtn.addEventListener('click', () => openLabelEditor(null));
if (labelEditorClose) labelEditorClose.addEventListener('click', closeLabelEditor);

if (labelSaveBtn) labelSaveBtn.addEventListener('click', async () => {
    if (!currentModalListId || !currentModalCardId) return;
    const list = boardData.find(l => l.id === currentModalListId);
    const card = list.cards.find(c => c.id === currentModalCardId);
    if (!card) return;
    if (!card.labels) card.labels = [];
    const newColor = labelCustomColor.value;
    const newName  = labelNameInput.value.trim();

    if (currentEditingLabelId) {
        const lbl = card.labels.find(l => l.id === currentEditingLabelId);
        if (lbl) {
            lbl.name  = newName;
            lbl.color = newColor;
            try { await apiBoard('update_label', { id: lbl.id, name: newName, color: newColor }); } catch(e) {}
        }
    } else {
        const newLabel = { id: 'lbl-' + Date.now(), name: newName, color: newColor };
        card.labels.push(newLabel);
        try { await apiBoard('add_label', { id: newLabel.id, card_id: card.id, name: newName, color: newColor }); } catch(e) {}
    }

    renderModalLabels(card);
    closeLabelEditor();
    const listEl = document.querySelector(`.list[data-id="${currentModalListId}"]`);
    if (listEl) {
        const cc = listEl.querySelector('.cards-container');
        cc.innerHTML = '';
        list.cards.forEach(c => cc.appendChild(createCardElement(c, list.id)));
    }
});

if (labelDeleteBtn) labelDeleteBtn.addEventListener('click', async () => {
    if (!currentModalListId || !currentModalCardId || !currentEditingLabelId) return;
    const list = boardData.find(l => l.id === currentModalListId);
    const card = list.cards.find(c => c.id === currentModalCardId);
    if (!card) return;
    card.labels = card.labels.filter(l => l.id !== currentEditingLabelId);
    try { await apiBoard('delete_label', { id: currentEditingLabelId }); } catch(e) {}
    renderModalLabels(card);
    closeLabelEditor();
    const listEl = document.querySelector(`.list[data-id="${currentModalListId}"]`);
    if (listEl) {
        const cc = listEl.querySelector('.cards-container');
        cc.innerHTML = '';
        list.cards.forEach(c => cc.appendChild(createCardElement(c, list.id)));
    }
});

// ── Move Card Logic ───────────────────────────────────────
const moveCardPopover  = document.getElementById('move-card-popover');
const movePopoverClose = document.getElementById('move-popover-close');
const moveListSelect   = document.getElementById('move-list-select');
const movePosSelect    = document.getElementById('move-pos-select');
const moveExecuteBtn   = document.getElementById('move-execute-btn');
let moveSourceListId = null;
let moveSourceCardId = null;

function openMoveCardPopover(triggerEl, listId, cardId) {
    moveSourceListId = listId;
    moveSourceCardId = cardId;
    moveListSelect.innerHTML = boardData.map(l => `<option value="${l.id}" ${l.id === listId ? 'selected' : ''}>${l.title}</option>`).join('');
    updateMovePositionDropdown(listId);
    const rect     = triggerEl.getBoundingClientRect();
    const modalEl  = document.querySelector('.modal-content');
    const mRect    = modalEl.getBoundingClientRect();
    let top  = rect.bottom - mRect.top + 5;
    let left = rect.left   - mRect.left;
    if (left + 300 > mRect.width) left = mRect.width - 310;
    moveCardPopover.style.top  = top  + 'px';
    moveCardPopover.style.left = left + 'px';
    moveCardPopover.classList.remove('hidden');
}
function closeMoveCardPopover() { moveCardPopover.classList.add('hidden'); }
function updateMovePositionDropdown(targetListId) {
    const list = boardData.find(l => l.id === targetListId);
    if (!list) return;
    const max = targetListId === moveSourceListId ? list.cards.length : list.cards.length + 1;
    
    let currentPos = -1;
    if (targetListId === moveSourceListId && moveSourceCardId) {
        const sourceList = boardData.find(l => l.id === moveSourceListId);
        if (sourceList) {
             currentPos = sourceList.cards.findIndex(c => c.id === moveSourceCardId) + 1;
        }
    }

    movePosSelect.innerHTML = Array.from({length: max}, (_, i) => {
        const pos = i + 1;
        return `<option value="${pos}">${pos}</option>`;
    }).join('');
    
    if (currentPos !== -1) {
        movePosSelect.value = currentPos;
    } else {
        movePosSelect.value = max;
    }
}
moveListSelect.addEventListener('change', e => updateMovePositionDropdown(e.target.value));
movePopoverClose.addEventListener('click', closeMoveCardPopover);
if (modalListName) modalListName.addEventListener('click', e => { if (modalListName.contentEditable !== 'true' && currentModalListId && currentModalCardId) openMoveCardPopover(e.currentTarget, currentModalListId, currentModalCardId); });
if (modalListNameDetail) modalListNameDetail.addEventListener('click', e => { if (currentModalListId && currentModalCardId) openMoveCardPopover(e.currentTarget, currentModalListId, currentModalCardId); });

function stripCurrentLabel(selectEl) { Array.from(selectEl.options).forEach(opt => opt.textContent = opt.textContent.replace(' (current)', '')); }
moveListSelect.addEventListener('mousedown', function() {
    Array.from(this.options).forEach(opt => { if (opt.value === moveSourceListId && !opt.textContent.endsWith(' (current)')) opt.textContent += ' (current)'; });
});
moveListSelect.addEventListener('change', function() { stripCurrentLabel(this); });
moveListSelect.addEventListener('blur', function() { stripCurrentLabel(this); });

movePosSelect.addEventListener('mousedown', function() {
    let cp = -1;
    if (moveListSelect.value === moveSourceListId) {
        const l = boardData.find(x => x.id === moveSourceListId);
        if (l) cp = l.cards.findIndex(c => c.id === moveSourceCardId) + 1;
    }
    Array.from(this.options).forEach(opt => { if (parseInt(opt.value) === cp && !opt.textContent.endsWith(' (current)')) opt.textContent += ' (current)'; });
});
movePosSelect.addEventListener('change', function() { stripCurrentLabel(this); });
movePosSelect.addEventListener('blur', function() { stripCurrentLabel(this); });

moveExecuteBtn.addEventListener('click', async () => {
    const targetListId = moveListSelect.value;
    const targetPos    = parseInt(movePosSelect.value) - 1;
    if (!moveSourceListId || !moveSourceCardId || isNaN(targetPos)) return;
    const sourceList = boardData.find(l => l.id === moveSourceListId);
    const targetList = boardData.find(l => l.id === targetListId);
    if (!sourceList || !targetList) return;
    const cardIdx = sourceList.cards.findIndex(c => c.id === moveSourceCardId);
    if (cardIdx === -1) return;
    const [cardData] = sourceList.cards.splice(cardIdx, 1);
    targetList.cards.splice(targetPos, 0, cardData);
    renderAllLists();
    if (currentModalCardId === moveSourceCardId) currentModalListId = targetListId;
    closeMoveCardPopover();
    showToast('Card berhasil dipindahkan!');
    await syncPositions();
});

// ── List Summary ──────────────────────────────────────────
function openListSummary(listId) {
    const list = boardData.find(l => l.id === listId);
    if (!list) return;
    summaryListName.textContent = `Summary: ${list.title}`;
    summaryContent.innerHTML = '';
    if (!list.cards.length) {
        summaryContent.innerHTML = '<p class="summary-empty-msg">Belum ada card di list ini.</p>';
        summaryCopyBtn.classList.add('hidden');
    } else {
        summaryCopyBtn.classList.remove('hidden');
        list.cards.forEach(card => {
            const item  = document.createElement('div'); item.className = 'summary-card-item';
            const title = document.createElement('div'); title.className = 'summary-card-title'; title.textContent = card.text;
            const desc  = document.createElement('div'); desc.className  = 'summary-card-desc';  desc.textContent  = card.description || '(No description)';
            item.appendChild(title); item.appendChild(desc); summaryContent.appendChild(item);
        });
    }
    summaryModal.classList.remove('hidden');
}
function closeListSummary() { summaryModal.classList.add('hidden'); }
window.addEventListener('click', e => { if (e.target === summaryModal) closeListSummary(); });
if (summaryCloseBtn) summaryCloseBtn.addEventListener('click', closeListSummary);
if (summaryCopyBtn) summaryCopyBtn.addEventListener('click', () => { navigator.clipboard.writeText(summaryContent.innerText).then(() => showToast('Summary disalin!')); });

// ── Attachments Section ───────────────────────────────────
function renderAttachments(listId, cardId, showAll = false) {
    const section       = document.getElementById('modal-attachments-section');
    const listContainer = document.getElementById('modal-attachments-list');
    if (!section || !listContainer) return;
    const list = boardData.find(l => l.id === listId);
    if (!list) return;
    const card = list.cards.find(c => c.id === cardId);
    if (!card) return;

    const allAtts = [];
    (card.comments || []).forEach(cmt => {
        (cmt.attachments || []).forEach((att, idx) => allAtts.push({ commentId: cmt.id, index: idx, ...att, timestamp: cmt.timestamp }));
    });

    if (!allAtts.length) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');
    listContainer.innerHTML = '';

    const displayed = showAll ? allAtts : allAtts.slice(0, 4);
    displayed.forEach(att => {
        const item  = document.createElement('div'); item.className = 'attachment-item';
        const ext   = att.name.split('.').pop().toUpperCase().slice(0, 4);
        const thumb = att.isImage ? `<img src="${att.data}" alt="${att.name}">` : `<span>${ext}</span>`;
        const d = new Date(att.timestamp);
        const dateStr = `${d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}, ${d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true})}`;
        item.innerHTML = `
            <div class="attachment-thumbnail">${thumb}</div>
            <div class="attachment-info"><div class="attachment-name" title="${att.name}">${att.name}</div><div class="attachment-meta">Added ${dateStr}</div></div>
            <div class="attachment-actions">
                <button class="attachment-action-btn" title="Open Preview"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
                <button class="attachment-action-btn danger" title="Delete" onclick="event.stopPropagation();deleteAttachment(${att.id})"><i class="fa-solid fa-ellipsis"></i></button>
            </div>`;
        item.onclick = () => openAttachmentPreviewModal(att);
        listContainer.appendChild(item);
    });

    if (allAtts.length > 4) {
        const btn = document.createElement('button'); btn.className = 'view-all-attachments-btn';
        if (showAll) { btn.textContent = 'Show less'; btn.onclick = () => renderAttachments(listId, cardId, false); }
        else { btn.textContent = `View all (${allAtts.length - 4} hidden)`; btn.onclick = () => renderAttachments(listId, cardId, true); }
        listContainer.appendChild(btn);
    }
}

window.deleteAttachment = async function(attId) {
    if (!confirm('Hapus attachment ini?')) return;
    try {
        await apiBoard('delete_attachment', { id: attId });
        // Remove from local state
        const list = boardData.find(l => l.id === currentModalListId);
        if (list) {
            const card = list.cards.find(c => c.id === currentModalCardId);
            if (card) {
                card.comments.forEach(cmt => {
                    cmt.attachments = (cmt.attachments || []).filter(a => a.id !== attId);
                });
            }
        }
        renderAttachments(currentModalListId, currentModalCardId);
        renderComments(currentModalListId, currentModalCardId);
        updateCardBadgesOnBoard(currentModalListId, currentModalCardId);
        showToast('Attachment dihapus.');
    } catch(e) { /* toast shown */ }
};

// ── Navigation Logic ──────────────────────────────────────
const scrollWipe = document.getElementById('scroll-wipe');

function doScrollWipe(swapFn) {
    if (!scrollWipe) { swapFn(); return; }
    scrollWipe.classList.add('animating');
    setTimeout(swapFn, 295);
    scrollWipe.addEventListener('animationend', () => scrollWipe.classList.remove('animating'), { once: true });
}
function requireLogin() {
    if (typeof switchToLogin === 'function') switchToLogin();
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.classList.remove('hidden');
}

function showLandingPage() { doScrollWipe(() => { landingPage.classList.remove('hidden'); boardContainer.classList.add('hidden'); document.body.classList.add('home-view'); }); }
function showBoard() {
    if (!getCurrentUser()) { requireLogin(); return; }
    doScrollWipe(() => { landingPage.classList.add('hidden'); boardContainer.classList.remove('hidden'); document.body.classList.remove('home-view'); });
}

// ── Sidebar Toggle ────────────────────────────────────────
const sidebarToggle = document.getElementById('sidebar-toggle');
const navDropdown   = document.getElementById('nav-dropdown');
const navGoHome     = document.getElementById('nav-go-home');
const navGoBoard    = document.getElementById('nav-go-board');
function closeNavDropdown() { if (navDropdown) navDropdown.classList.add('hidden'); }
if (sidebarToggle) sidebarToggle.addEventListener('click', e => { e.stopPropagation(); navDropdown.classList.toggle('hidden'); });
if (navGoHome)  navGoHome.addEventListener('click',  () => { showLandingPage(); closeNavDropdown(); });
if (navGoBoard) navGoBoard.addEventListener('click', () => { showBoard();       closeNavDropdown(); });
document.addEventListener('click', e => {
    if (navDropdown && !navDropdown.classList.contains('hidden') && !sidebarToggle.contains(e.target) && !navDropdown.contains(e.target)) closeNavDropdown();
});

// ── Hero Buttons & Scrolling ──────────────────────────────────────────
const heroStartBtn = document.getElementById('hero-start-btn');
if (heroStartBtn) heroStartBtn.addEventListener('click', showBoard);

function scrollToHiw() {
    const lp = document.querySelector('.landing-page-container');
    const hiwSection = document.getElementById('how-it-works-section');
    if (lp && hiwSection) {
        lp.scrollTo({
            top: hiwSection.offsetTop,
            behavior: 'smooth'
        });
    }
}

const heroHowBtn = document.getElementById('hero-how-btn');
if (heroHowBtn) heroHowBtn.addEventListener('click', scrollToHiw);

const scrollToHiwBtn = document.getElementById('scroll-to-hiw');
if (scrollToHiwBtn) scrollToHiwBtn.addEventListener('click', scrollToHiw);

