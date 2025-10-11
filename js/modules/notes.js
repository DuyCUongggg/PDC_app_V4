// ===== NOTES MODULE =====

// Initialize notes data structure
if (!window.appData) window.appData = {};
if (!window.appData.notes) window.appData.notes = [];

// Simple backup system like products module

// Sync indicator functions (simple implementation)
function showSyncIndicator(message) {
    // Simple console log instead of UI indicator
    console.log('🔄', message);
}

function hideSyncIndicator() {
    // Simple console log instead of UI indicator
    console.log('✅ Sync indicator hidden');
}

// Debounce/guard for fetch to prevent spam
let _notesSyncInFlight = false;
let _lastNotesFetchAt = 0;
const NOTES_FETCH_MIN_INTERVAL_MS = 30000; // 30s - reduce flickering
let _notesSyncInterval = null;
let _notesRetryCount = 0;
const MAX_RETRY_COUNT = 3;

// Debounce render to prevent excessive re-renders
let _renderTimeout = null;
const RENDER_DEBOUNCE_MS = 100;


(function initNotes() {
    // Load notes from localStorage on init
    loadNotesFromStorage();
    normalizeNotes();
    renderNotesList();
    renderNotesCategories();
    loadSavedTags();
    loadSavedTagColors();
    renderSavedTagsUI();
    populateTagSelect();
    // Initialize note form
    initNoteForm();
    // Notes will be loaded in app.js DOMContentLoaded (same timing as products)
    
    // No automatic periodic sync - only sync when needed (like products module)
    
})();

// Switch between list and add views
window.switchNotesView = function(view) {
    try {
        const listView = document.getElementById('notesListView');
        const addView = document.getElementById('notesAddView');
        const listBtn = document.getElementById('notesListBtn');
        const addBtn = document.getElementById('notesAddBtn');
        if (!listView || !addView || !listBtn || !addBtn) return;
        const showList = view !== 'add';
        listView.style.display = showList ? 'block' : 'none';
        addView.style.display = showList ? 'none' : 'block';
        listBtn.classList.toggle('active', showList);
        addBtn.classList.toggle('active', !showList);
        if (showList) {
            debouncedRenderNotesList();
        }
    } catch {}
}

// Generate unique ID for notes
function generateNoteId() {
    return 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Validate order code format for note thông tin
function validateOrderCodeFormat(orderCode) {
    console.log('🔍 validateOrderCodeFormat input:', orderCode);
    
    if (!orderCode || typeof orderCode !== 'string') {
        console.log('❌ Invalid input');
        return false;
    }
    
    const code = orderCode.trim().toUpperCase();
    console.log('🔍 Normalized code:', code);
    
    // Format 1: DH + số (ví dụ: DH123456)
    const dhPattern = /^DH\d+$/;
    if (dhPattern.test(code)) {
        console.log('✅ DH format match');
        return true;
    }
    
    // Format 2: Mã + RESELLER (ví dụ: CSE7QYZHMC9 RESELLER)
    const resellerPattern = /^.+ RESELLER$/;
    if (resellerPattern.test(code)) {
        console.log('✅ RESELLER format match');
        return true;
    }
    
    console.log('❌ No format match');
    return false;
}

// Create new note
function createNote() {
    
    const noteContent = document.getElementById('noteContent')?.value.trim();
    const tagSelect = document.getElementById('noteTagSelect');
    const selectedTag = (tagSelect?.value || '').trim();
    
    // Basic validation
    if (!noteContent) {
        showNotification('Vui lòng nhập nội dung ghi chú!', 'error');
        return;
    }
    if (!selectedTag) {
        showNotification('Vui lòng chọn phân loại!', 'error');
        return;
    }
    
    let chatLink = '';
    let orderCode = '';
    let title = '';
    
    // Different validation based on tag type
    if (selectedTag === 'chua-xu-ly') {
        // For "Chưa xử lý" - require chat link, order code optional
        chatLink = document.getElementById('noteChatLink')?.value.trim();
        orderCode = document.getElementById('noteOrderId')?.value.trim();
        
        if (!chatLink) {
            showNotification('Vui lòng nhập link chat!', 'error');
            return;
        }
        
        // Validate URL format
        try {
            new URL(chatLink);
        } catch (e) {
            showNotification('Link chat không hợp lệ! Vui lòng nhập URL đúng định dạng.', 'error');
            return;
        }
        
        // Validate order code format if provided
        if (orderCode) {
            console.log('🔍 Validating order code for chua-xu-ly:', orderCode);
            const isValidFormat = validateOrderCodeFormat(orderCode);
            console.log('✅ Validation result:', isValidFormat);
            if (!isValidFormat) {
                showNotification('Mã đơn hàng không đúng định dạng!\n\nĐịnh dạng hợp lệ:\n• DH + số (ví dụ: DH123456)\n• Mã + RESELLER (ví dụ: CSE7QYZHMC9 RESELLER)', 'error');
                return;
            }
        } else {
            // If no order code provided, generate a temporary one for database
            orderCode = 'TEMP_' + Date.now();
        }
    } else if (selectedTag === 'note-thong-tin') {
        // For "Note thông tin" - require chat link, order code optional
        title = document.getElementById('noteTitle')?.value.trim();
        chatLink = document.getElementById('noteChatLink')?.value.trim();
        orderCode = document.getElementById('noteOrderId')?.value.trim();
        
        if (!chatLink) {
            showNotification('Vui lòng nhập link chat!', 'error');
            return;
        }
        
        // Validate URL format
        try {
            new URL(chatLink);
        } catch (e) {
            showNotification('Link chat không hợp lệ! Vui lòng nhập URL đúng định dạng.', 'error');
            return;
        }
        
        // Validate order code format if provided
        if (orderCode) {
            console.log('🔍 Validating order code:', orderCode);
            const isValidFormat = validateOrderCodeFormat(orderCode);
            console.log('✅ Validation result:', isValidFormat);
            if (!isValidFormat) {
                showNotification('Mã đơn hàng không đúng định dạng!\n\nĐịnh dạng hợp lệ:\n• DH + số (ví dụ: DH123456)\n• Mã + RESELLER (ví dụ: CSE7QYZHMC9 RESELLER)', 'error');
                return;
            }
        } else {
            // If no order code provided, generate a temporary one for database
            orderCode = 'TEMP_' + Date.now();
        }
    }
    
    // Build tags string (comma-separated, lowercased, trimmed)
    let tags = [selectedTag]
        .filter(Boolean)
        .join(',')
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean)
        .join(',');
    if (!tags) tags = '';

    // Create note object with enhanced validation
    const note = {
        id: generateNoteId(),
        chatLink: chatLink,
        orderCode: orderCode,
        title: title,
        content: noteContent,
        status: 'active',
        tags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Add integrity markers
        _localVersion: 1,
        _lastModified: Date.now()
    };
    
    try {
        // Add to notes array
        window.appData.notes.unshift(note); // Add to beginning
        
        // Clear form
        clearNoteForm();
        
        // Re-render list immediately (no debounce for create)
        renderNotesList();
        renderNotesCategories();
        
        // Save to localStorage with backup
        saveNotesToStorage();
        
        // Simple notification like products
        showNotification('Đã tạo ghi chú mới thành công!', 'success');
    } catch (error) {
        console.error('Create note failed:', error);
        showNotification('Lỗi khi tạo ghi chú!', 'error');
    }
}
window.createNote = createNote;

// Clear note form
function clearNoteForm() {
    const fields = ['noteContent', 'noteChatLink', 'noteOrderId', 'noteTitle'];
    fields.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });
    const tagSelect = document.getElementById('noteTagSelect');
    if (tagSelect) {
        tagSelect.value = 'chua-xu-ly'; // Reset to default
        // Show default fields
        toggleNoteFields();
    }
}
window.clearNoteForm = clearNoteForm;

// Copy current chat link
function copyCurrentChatLink() {
    const chatLink = document.getElementById('noteChatLink')?.value.trim();
    if (!chatLink) {
        showNotification('Chưa có link để copy!', 'error');
        return;
    }
    
    navigator.clipboard.writeText(chatLink).then(() => {
    // Không cần thông báo thêm nếu copy thành công im lặng cũng được
    showNotification('Đã copy link chat!', 'success');
    }).catch(() => {
        showNotification('Không thể copy link!', 'error');
    });
}
window.copyCurrentChatLink = copyCurrentChatLink;

// Copy note chat link
function copyNoteChatLink(noteId) {
    const note = window.appData.notes.find(n => n.id === noteId);
    if (!note) {
        showNotification('Không tìm thấy ghi chú!', 'error');
        return;
    }
    
    navigator.clipboard.writeText(note.chatLink).then(() => {
        showNotification('Đã copy link chat!', 'success');
    }).catch(() => {
        showNotification('Không thể copy link!', 'error');
    });
}
window.copyNoteChatLink = copyNoteChatLink;

// Complete note (delete with success message)
async function completeNote(noteId) {
    const note = window.appData.notes.find(n => n.id === noteId);
    if (!note) {
        showNotification('Không tìm thấy ghi chú!', 'error');
        return;
    }
    
    // Mark as completed instead of deleting
        note.status = 'đã hoàn thành';
    note.completedAt = new Date().toISOString();
    
    // Update UI immediately (no debounce for complete)
    renderNotesList();
    renderNotesCategories();
    saveNotesToStorage();
    
    // Simple notification like products
    showNotification('Đã hoàn thành ghi chú!', 'success');
}
window.completeNote = completeNote;

// Custom delete confirmation modal
function showDeleteConfirmation(note) {
    return new Promise((resolve) => {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'delete-modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        `;
        
        // Create modal content
        const modal = document.createElement('div');
        modal.className = 'delete-modal';
        modal.style.cssText = `
            background: #1f2937;
            border-radius: 12px;
            padding: 24px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease;
            border: 1px solid #374151;
        `;
        
        // Get note preview
        const content = String(note.content || '').trim();
        const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;
        const orderCode = note.orderCode && !note.orderCode.startsWith('TEMP_') ? note.orderCode : '';
        
        modal.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 48px; margin-bottom: 12px;">🗑️</div>
                <h3 style="color: #f9fafb; margin: 0 0 8px 0; font-size: 18px; font-weight: 600;">Xóa ghi chú</h3>
                <p style="color: #9ca3af; margin: 0; font-size: 14px;">Bạn có chắc chắn muốn xóa ghi chú này?</p>
            </div>
            
            <div style="background: #111827; border-radius: 8px; padding: 12px; margin-bottom: 20px; border: 1px solid #374151;">
                ${orderCode ? `<div style="color: #60a5fa; font-weight: 500; margin-bottom: 4px;">${orderCode}</div>` : ''}
                <div style="color: #d1d5db; font-size: 14px; line-height: 1.4;">${preview || 'Ghi chú trống'}</div>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button class="cancel-btn" style="
                    background: #374151;
                    color: #f9fafb;
                    border: 1px solid #4b5563;
                    border-radius: 8px;
                    padding: 10px 20px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                ">Hủy</button>
                <button class="delete-btn" style="
                    background: #dc2626;
                    color: white;
                    border: 1px solid #dc2626;
                    border-radius: 8px;
                    padding: 10px 20px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                ">Xóa</button>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideIn {
                from { transform: translateY(-20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .cancel-btn:hover {
                background: #4b5563 !important;
                border-color: #6b7280 !important;
            }
            .delete-btn:hover {
                background: #b91c1c !important;
                border-color: #b91c1c !important;
            }
        `;
        document.head.appendChild(style);
        
        // Add event listeners
        const cancelBtn = modal.querySelector('.cancel-btn');
        const deleteBtn = modal.querySelector('.delete-btn');
        
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            document.head.removeChild(style);
            resolve(false);
        });
        
        deleteBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            document.head.removeChild(style);
            resolve(true);
        });
        
        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                document.head.removeChild(style);
                resolve(false);
            }
        });
        
        // Add to DOM
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    });
}

// Delete note with custom modal
async function deleteNote(noteId) {
    const note = window.appData.notes.find(n => n.id === noteId);
    if (!note) {
        showNotification('Không tìm thấy ghi chú!', 'error');
        return;
    }
    
    // Show custom confirmation modal
    const confirmed = await showDeleteConfirmation(note);
    if (!confirmed) return;
    const deletedId = noteId;
    window.appData.notes = window.appData.notes.filter(n => n.id !== deletedId);
    renderNotesList();
    renderNotesCategories();
    saveNotesToStorage();
    try {
        const url = (window.GAS_URL || '') + '?token=' + encodeURIComponent(window.GAS_TOKEN || '');
        const payload = { action: 'notesDelete', ids: [deletedId] };
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) { /* Handle error silently */ }
    } catch (e) { /* Handle error silently */ }
    
    // Simple notification like products
    showNotification('Đã xóa ghi chú!', 'success');
}
window.deleteNote = deleteNote;

// Get status icon based on order code
function getStatusIcon(orderCode) {
    const code = String(orderCode || '').toLowerCase();
    if (code.includes('dh') || code.includes('order')) return '🛍️';
    if (code.includes('sp') || code.includes('product')) return '📦';
    if (code.includes('kh') || code.includes('customer')) return '👤';
    if (code.includes('hd') || code.includes('invoice')) return '🧾';
    return '📋';
}

// Get platform icon from chat link
function getPlatformIcon(chatLink) {
    const link = String(chatLink || '').toLowerCase();
    if (link.includes('facebook') || link.includes('m.me')) return '💙';
    if (link.includes('zalo')) return '🔵';
    if (link.includes('telegram')) return '✈️';
    if (link.includes('whatsapp')) return '💚';
    if (link.includes('instagram')) return '📸';
    return '💬';
}

// Format date for display
function formatNoteDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hour}:${minute}`;
}

// Debounced render function
function debouncedRenderNotesList() {
    if (_renderTimeout) {
        clearTimeout(_renderTimeout);
    }
    _renderTimeout = setTimeout(() => {
        debouncedRenderNotesList();
    }, RENDER_DEBOUNCE_MS);
}

// Render notes list
function renderNotesList() {
    const container = document.getElementById('notesList');
    const countElement = document.getElementById('notesCount');
    const activeCategory = window.__notesActiveCategory || 'all';
    const masonry = document.querySelector('.notes-masonry');
    
    if (!container) return;
    
    // Add filtering class to prevent animations
    if (masonry) {
        masonry.classList.add('filtering');
    }
    
    // Show/hide bulk actions based on category
    const bulkActionsContainer = document.getElementById('bulkActionsContainer');
    if (bulkActionsContainer) {
        if (activeCategory === 'completed') {
            bulkActionsContainer.style.display = 'block';
        } else {
            bulkActionsContainer.style.display = 'none';
        }
    }
    
    let notes = window.appData.notes || [];
    
    // Filter by active category if not 'all'
    if (activeCategory && activeCategory !== 'all') {
        if (activeCategory === 'completed') {
            // Show only completed notes
            notes = notes.filter(n => n.status === 'completed' || n.status === 'đã hoàn thành');
        } else {
            // Show only active notes (not completed) for other categories
        notes = notes.filter(n => {
            const tags = String(n.tags || '').toLowerCase();
                return tags === activeCategory && n.status !== 'completed' && n.status !== 'đã hoàn thành';
            });
        }
    } else {
        // For 'all' category, show only active notes (not completed)
        notes = notes.filter(n => n.status !== 'completed' && n.status !== 'đã hoàn thành');
    }
    
    // Filter by search term
    const searchTerm = window.__notesSearchTerm || '';
    if (searchTerm) {
        notes = notes.filter(note => {
            const orderCode = String(note.orderCode || '').toLowerCase();
            const chatLink = String(note.chatLink || '').toLowerCase();
            const content = String(note.content || '').toLowerCase();
            const title = String(note.title || '').toLowerCase();
            
            return orderCode.includes(searchTerm) || 
                   chatLink.includes(searchTerm) || 
                   content.includes(searchTerm) ||
                   title.includes(searchTerm);
        });
    }
    
    // Filter by time range
    const timeFilter = window.__notesTimeFilter || 'all';
    if (timeFilter !== 'all') {
        notes = notes.filter(note => isNoteInTimeRange(note, timeFilter));
    }
    
    // Update count
    if (countElement) {
        countElement.textContent = `${notes.length} ghi chú`;
    }
    
    if (notes.length === 0) {
    container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <h4>Chưa có ghi chú</h4>
                <p>Tạo ghi chú đầu tiên cho khách hàng</p>
            </div>
        `;
        return;
    }
    
    const cards = notes.map(note => {
        const tags = String(note.tags || '').toLowerCase().trim();
        const isInfoNote = tags === 'note-thong-tin';
        const isPendingNote = tags === 'chua-xu-ly';
        
        // Determine note type label and class
        let typeLabel = '';
        let typeClass = '';
        if (note.status === 'completed' || note.status === 'đã hoàn thành') {
            typeLabel = 'Đã hoàn thành';
            typeClass = 'note-completed';
        } else if (isInfoNote) {
            typeLabel = 'Note thông tin';
            typeClass = 'note-info';
        } else if (isPendingNote) {
            typeLabel = 'Chưa xử lý';
            typeClass = 'note-pending';
        } else {
            typeLabel = 'Active';
            typeClass = 'active';
        }
        
        let headerContent = '';
        if (isInfoNote) {
            // For "Note thông tin" - show title (fallback to orderCode or first content line)
            const rawTitle = String(note.title || note.orderCode || '').trim();
            const fallback = String(note.content || '').split('\n')[0] || '';
            const titleToShow = (rawTitle || fallback || '');
            headerContent = `<div class="v3-title">${titleToShow.replace(/\n/g,'<br>')}</div>`;
        } else {
            // For "Chưa xử lý" - show order code and chat link
            const orderCode = String(note.orderCode || '').trim();
            const link = String(note.chatLink || '');
            const linkShort = link.length > 40 ? link.substring(0,40) + '…' : link;
            const linkTitle = linkShort || '—';
            
            // Only show order code if it's not a temporary code
            if (orderCode && !orderCode.startsWith('TEMP_')) {
                headerContent = `
                    <div class="v3-order-code">${orderCode}</div>
                    <a class="v3-link" href="${link}" target="_blank" title="Mở link chat">${linkTitle}</a>
                `;
            } else {
                headerContent = `<a class="v3-link" href="${link}" target="_blank" title="Mở link chat">${linkTitle}</a>`;
            }
        }
        
        // Add checkbox for completed notes
        const checkboxHtml = (note.status === 'completed' || note.status === 'đã hoàn thành') ? 
            `<input type="checkbox" class="note-checkbox" data-note-id="${note.id}" onchange="updateBulkActions()">` : '';
        
        // Determine card type for border color - only for info and completed
        let cardType = '';
        if (note.status === 'completed' || note.status === 'đã hoàn thành') {
            cardType = 'completed';
        } else if (isInfoNote) {
            cardType = 'note-thong-tin';
        }
        // For pending cards, cardType remains empty string - no special styling
        
        return `
        <div class="note-cardv3 ${typeClass}" id="note-${note.id}" data-note-id="${note.id}" data-type="${cardType}">
            ${checkboxHtml}
            <div class="v3-head">
                ${headerContent}
                <span class="v3-status ${typeClass}">${typeLabel}</span>
            </div>
            <div class="v3-body">${String(note.content || '').replace(/\n/g,'<br>')}</div>
            <div class="v3-foot">
                <span class="v3-time">${formatNoteDateDetailed(note.createdAt)}</span>
            </div>
            <div class="v3-actions">
                <button class="icon-btn" title="Chỉnh sửa" onclick="editNote('${note.id}')">✏️</button>
                ${(note.status === 'completed' || note.status === 'đã hoàn thành') ? '' : (isInfoNote ? '' : `<button class="icon-btn" title="Copy" onclick="copyNoteChatLink('${note.id}')">📋</button>`)}
                ${(note.status === 'completed' || note.status === 'đã hoàn thành') ? '' : `<button class="icon-btn ${isInfoNote ? 'delete' : 'ok'}" title="${isInfoNote ? 'Xóa note' : 'Hoàn thành'}" onclick="${isInfoNote ? 'deleteNote' : 'completeNote'}('${note.id}')">${isInfoNote ? '🗑️' : '✅'}</button>`}
            </div>
        </div>`;
    }).join('');
    
    // Masonry layout for notes - use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    const masonryDiv = document.createElement('div');
    masonryDiv.className = 'notes-masonry';
    masonryDiv.innerHTML = cards;
    fragment.appendChild(masonryDiv);
    
    // Clear and append in one operation
    container.innerHTML = '';
    container.appendChild(fragment);
}

// Render categories into sidebar with counts
function renderNotesCategories() {
    // This function is now handled by the new filter system
    // Keeping empty to avoid breaking existing calls
}
window.renderNotesCategories = renderNotesCategories;

//

// Settings modal handlers
window.openTagsSettings = function() {
    try {
        const m = document.getElementById('tagsSettingsModal');
        if (!m) return; m.classList.add('show');
        renderTagsManageList();
    } catch {}
}
window.closeTagsSettings = function() {
    const m = document.getElementById('tagsSettingsModal');
    if (m) m.classList.remove('show');
}
function renderTagsManageList() {
    const el = document.getElementById('tagsManageList');
    if (!el) return;
    const tags = window.__savedTags || [];
    el.innerHTML = tags.map(t => {
        const hex = (window.__savedTagColors||{})[t] || '#3182ce';
        return `
        <div class="notes-category-item" style="display:flex; align-items:center; justify-content:space-between;">
            <div style="display:flex; align-items:center; gap:8px;">
                <input type="color" value="${hex}" onchange="updateSavedTagColor('${t}', this.value)" title="Màu của tag" style="width:28px; height:28px; border:none; background:transparent; padding:0;" />
                <span>${t}</span>
            </div>
            <div style="display:flex; gap:6px;">
                <button class="btn btn-outline btn-sm" onclick="renameSavedTagPrompt('${t}')">Sửa</button>
                <button class="btn btn-danger btn-sm" onclick="removeSavedTag('${t}'); renderTagsManageList();">Xóa</button>
            </div>
        </div>`;
    }).join('');
}
window.addNewTagFromModal = function() {
    const input = document.getElementById('newTagInput');
    if (!input) return;
    const val = (input.value || '').trim().toLowerCase();
    if (!val) return;
    window.__savedTags = Array.from(new Set([...(window.__savedTags||[]), val]));
    saveSavedTags(); populateTagSelect(); renderSavedTagsUI(); renderNotesCategories(); renderTagsManageList();
    input.value = '';
}
window.renameSavedTagPrompt = function(oldTag) {
    const nv = prompt('Đổi tên tag', oldTag);
    if (!nv) return;
    const newTag = nv.trim().toLowerCase();
    if (!newTag) return;
    window.__savedTags = (window.__savedTags||[]).map(t => t === oldTag ? newTag : t);
    if (window.__savedTagColors && window.__savedTagColors[oldTag]) {
        window.__savedTagColors[newTag] = window.__savedTagColors[oldTag];
        delete window.__savedTagColors[oldTag];
        saveSavedTagColors();
    }
    saveSavedTags(); populateTagSelect(); renderSavedTagsUI(); renderNotesCategories(); renderTagsManageList();
}

window.updateSavedTagColor = function(tag, hex) {
    try {
        if (!window.__savedTagColors) window.__savedTagColors = {};
        window.__savedTagColors[tag] = hex;
        saveSavedTagColors();
        renderNotesCategories();
    } catch {}
}

function hexToRgba(hex, alpha) {
    try {
        const h = hex.replace('#','');
        const expanded = h.length===3 ? h.split('').map(c=>c+c).join('') : h;
        const bigint = parseInt(expanded, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } catch { return 'rgba(49,130,206,0.12)'; }
}

// Save notes to localStorage
function saveNotesToStorage() {
    try {
        const dataToSave = {
            ...window.appData,
            notes: window.appData.notes,
            metadata: {
                ...window.appData.metadata,
                lastUpdated: new Date().toISOString()
            }
        };
        localStorage.setItem('pdc_app_data', JSON.stringify(dataToSave));
    } catch (error) {
        // Handle error silently
        showNotification('Lỗi lưu ghi chú!', 'error');
    }
}

// Simple save to localStorage like products module
function saveNotesToStorage() {
    try {
        const data = {
            notes: window.appData.notes || [],
            lastSaved: Date.now(),
            version: '1.1'
        };
        
        localStorage.setItem('pdc_app_data', JSON.stringify(data));
        
    } catch (error) {
        console.error('Save failed:', error);
        showNotification('Lỗi lưu dữ liệu!', 'error');
    }
}

// Simple load from localStorage like products module
function loadNotesFromStorage() {
    try {
        const saved = localStorage.getItem('pdc_app_data');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.notes && Array.isArray(parsed.notes)) {
                window.appData.notes = parsed.notes;
            }
        }
    } catch (error) {
        console.error('Load notes failed:', error);
        // Keep existing notes safe
        if (!window.appData.notes || window.appData.notes.length === 0) {
            window.appData.notes = [];
        }
    }
}


// Update notes tab (called from main app)
function updateNotesTab() {
    renderNotesList();
    renderNotesCategories();
    // Notes already loaded on init (like products module)
}
window.updateNotesTab = updateNotesTab;

// Periodic sync removed - notes module now works like products module

// === Sync notes to Google Sheets using existing Apps Script endpoint ===
async function syncNotesToGoogleSheets() {
    try {
        const url = (window.GAS_URL || '') + '?token=' + encodeURIComponent(window.GAS_TOKEN || '');
        const payload = { action: 'notesUpsert', notes: (window.appData.notes || []).map(n => ({
            id: n.id,
            orderCode: n.orderCode || '',
            chatLink: n.chatLink || '',
            content: n.content || '',
            status: n.status || 'active',
            createdAt: n.createdAt || new Date().toISOString(),
            updatedAt: n.updatedAt || new Date().toISOString(),
            tags: n.tags || ''
        })) };
        
        // Show sync indicator
        showSyncIndicator('Syncing...');
        
        // Use text/plain to avoid CORS preflight like products
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
        const json = await res.json().catch(() => ({}));
        
        if (!res.ok || !json.success) {
            // Handle error silently
            console.error('❌ Sync failed:', res.status, json);
            _notesRetryCount++;
            if (_notesRetryCount < MAX_RETRY_COUNT) {
                // Retry sync silently
                console.log('🔄 Retrying sync...', _notesRetryCount);
                setTimeout(() => syncNotesToGoogleSheets(), 2000 * _notesRetryCount);
            } else {
            // Sync failed, will retry later
                console.error('❌ Sync failed after retries');
                _notesRetryCount = 0;
            }
        } else {
            // Sync successful, no notification needed
            console.log('✅ Sync successful:', json);
            _notesRetryCount = 0;
        }
    } catch (e) {
        // Handle error silently
        _notesRetryCount++;
        if (_notesRetryCount < MAX_RETRY_COUNT) {
            // Network error, retry silently
            setTimeout(() => syncNotesToGoogleSheets(), 2000 * _notesRetryCount);
        } else {
        // Network sync failed, will retry later
            _notesRetryCount = 0;
        }
    } finally {
        hideSyncIndicator();
    }
}

// === Fetch notes from Google Sheets (Sheet2) and merge by updatedAt ===
async function refreshNotesFromSheets(force = false) {
    try {
        if (_notesSyncInFlight) return; // already running
        const now = Date.now();
        if (!force && now - _lastNotesFetchAt < NOTES_FETCH_MIN_INTERVAL_MS) return; // too recent
        _notesSyncInFlight = true; _lastNotesFetchAt = now;
        
        const base = (window.GAS_URL || '');
        if (!base) return;
        
        // Show sync indicator for manual refreshes
        if (force) {
            showSyncIndicator('Loading from Sheet2...');
        }
        
        const url = base + '?action=notesList&token=' + encodeURIComponent(window.GAS_TOKEN || '');
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
            if (force) {
                // Connection failed, will retry later
            }
            return;
        }
        
        const data = await res.json();
        console.log('📥 Received from Google Sheets:', data);
        if (!data || !data.success || !Array.isArray(data.data)) {
            if (force) {
                console.error('❌ Invalid data from Google Sheets:', data);
            }
            return;
        }
        
        // Validate that payload is truly notes (not products)
        const incoming = (data.data || []).filter(n => {
            // must have id and at least one of orderCode/content/chatLink/status
            if (!n || !n.id) return false;
            const hasNoteFields = ('orderCode' in n) || ('content' in n) || ('chatLink' in n) || ('status' in n);
            // guard against products payload (name/price without note fields)
            const looksLikeProduct = ('name' in n) && ('price' in n) && !hasNoteFields;
            return hasNoteFields && !looksLikeProduct;
        });
        
        if (incoming.length === 0) {
            // If server returns empty and we're forcing refresh (after delete), clear local notes
            if (force) {
                console.log('📥 Server has no notes, clearing local notes...');
                window.appData.notes = [];
                debouncedRenderNotesList();
                saveNotesToStorage();
                console.log('✅ Local notes cleared');
                
                // Notification now handled by loadNotesFromGoogleSheets (same as products)
            }
            return;
        }
        
        // Smart merge: Only update if there are actual changes
        console.log('🔄 Checking for changes in Google Sheets data...');
        console.log('📊 Local notes:', window.appData.notes.length);
        console.log('📊 Google Sheets notes:', incoming.length);
        
        // Check if we need to update (only if server has more recent data)
        const localLatest = Math.max(...window.appData.notes.map(n => new Date(n.updatedAt || n.createdAt || 0).getTime()));
        const serverLatest = Math.max(...incoming.map(n => new Date(n.updatedAt || n.createdAt || 0).getTime()));
        
        if (serverLatest > localLatest || force) {
            console.log('📥 Server has newer data, updating...');
            // Sort by creation date (newest first)
            const sortedNotes = incoming.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            
            // Replace local notes only if server is newer
            window.appData.notes = sortedNotes;
            debouncedRenderNotesList();
            saveNotesToStorage();
            
            console.log('✅ Notes updated successfully');
        } else {
            console.log('✅ Local data is up to date, no update needed');
        }
        
        if (force) {
            // Show notes loaded notification (like products module)
            const notesCount = window.appData.notes ? window.appData.notes.length : 0;
            // Notification now handled by loadNotesFromGoogleSheets (same as products)
        }
    } catch (e) {
        // Handle error silently
        if (force) {
        // Failed to load notes, will retry later
        }
    } finally {
        _notesSyncInFlight = false;
        if (force) {
            hideSyncIndicator();
        }
    }
}

// Ensure each note has required fields to avoid undefined errors
function normalizeNotes() {
    try {
        if (!Array.isArray(window.appData.notes)) { window.appData.notes = []; return; }
        window.appData.notes = window.appData.notes.map(n => ({
            id: n.id || generateNoteId(),
            orderCode: n.orderCode || '',
            chatLink: n.chatLink || '',
            content: n.content || '',
            status: n.status || 'active',
            tags: n.tags || '',
            createdAt: n.createdAt || new Date().toISOString(),
            updatedAt: n.updatedAt || n.createdAt || new Date().toISOString()
        }));
    } catch {}
}


// Enhanced cleanup with conflict resolution
async function cleanupDeletedNotes() {
    try {
        const base = (window.GAS_URL || '');
        if (!base) {
            showNotification('Không thể kết nối đến server!', 'error');
            return;
        }
        
        
        const url = base + '?action=notesList&token=' + encodeURIComponent(window.GAS_TOKEN || '');
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
            showNotification('Lỗi kết nối server!', 'error');
            return;
        }
        
        const data = await res.json();
        if (!data || !data.success || !Array.isArray(data.data)) {
            showNotification('Dữ liệu server không hợp lệ!', 'error');
            return;
        }
        
        const sheetNoteIds = new Set(data.data.map(n => n.id));
        const localNotes = window.appData.notes || [];
        const notesToKeep = localNotes.filter(note => sheetNoteIds.has(note.id));
        const notesToDelete = localNotes.length - notesToKeep.length;
        
        if (notesToDelete > 0) {
            // Show detailed warning with note preview
            const deletedNotes = localNotes.filter(note => !sheetNoteIds.has(note.id));
            const preview = deletedNotes.slice(0, 3).map(n => `• ${n.content.substring(0, 50)}...`).join('\n');
            const moreText = deletedNotes.length > 3 ? `\n... và ${deletedNotes.length - 3} ghi chú khác` : '';
            
            if (!confirm(`⚠️ CẢNH BÁO: Sẽ xóa ${notesToDelete} ghi chú không có trong Google Sheets.\n\n${preview}${moreText}\n\nBạn có chắc muốn tiếp tục?`)) {
                return;
            }
            
            // Perform cleanup
            window.appData.notes = notesToKeep;
            debouncedRenderNotesList();
            renderNotesCategories();
            saveNotesToStorage();
            showNotification(`Đã xóa ${notesToDelete} ghi chú!`, 'warning');
        } else {
            showNotification('Không có ghi chú nào cần dọn dẹp!', 'success');
        }
    } catch (e) {
        console.error('Cleanup failed:', e);
        showNotification('Lỗi khi dọn dẹp!', 'error');
    }
}

// Enhanced sync with retry mechanism
async function syncNotesToGoogleSheetsWithRetry() {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
        try {
            await syncNotesToGoogleSheets();
            _notesRetryCount = 0; // Reset on success
            return true;
        } catch (error) {
            retryCount++;
            console.warn(`Sync attempt ${retryCount} failed:`, error);
            
            if (retryCount < maxRetries) {
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            } else {
                console.error('All sync attempts failed');
                showNotification('Đồng bộ thất bại! Dữ liệu đã được lưu local.', 'warning');
                return false;
            }
        }
    }
}

// Enhanced data validation
function validateNoteData(note) {
    if (!note || typeof note !== 'object') return false;
    
    const requiredFields = ['id', 'content', 'status', 'createdAt', 'updatedAt'];
    for (const field of requiredFields) {
        if (!note[field]) return false;
    }
    
    // Validate dates
    if (isNaN(new Date(note.createdAt).getTime()) || 
        isNaN(new Date(note.updatedAt).getTime())) {
        return false;
    }
    
    return true;
}

// Enhanced save with validation
function saveNotesToStorage() {
    try {
        // Validate all notes before saving
        const validNotes = window.appData.notes.filter(validateNoteData);
        
        if (validNotes.length !== window.appData.notes.length) {
            console.warn(`Filtered out ${window.appData.notes.length - validNotes.length} invalid notes`);
            window.appData.notes = validNotes;
        }
        
        const data = {
            notes: window.appData.notes,
            lastSaved: Date.now(),
            version: '1.1'
        };
        
        localStorage.setItem('pdc_app_data', JSON.stringify(data));
        
        
    } catch (error) {
        console.error('Save failed:', error);
        showNotification('Lỗi lưu dữ liệu!', 'error');
    }
}

// Load notes from Google Sheets (same mechanism as products)
async function loadNotesFromGoogleSheets() {
    try {
        // Use same notification system as products
        if (typeof window.showNotification === 'function') {
            window.showNotification('Đang tải dữ liệu từ Google Sheets...', 'info');
        }
        
        // Use same fetch mechanism as products
        const response = await fetch(`${window.GAS_URL}?action=notesList&token=${encodeURIComponent(window.GAS_TOKEN || '')}`);
        const result = await response.json();
        
        if (result.success && Array.isArray(result.data)) {
            // Replace local notes with server data (same as products)
            window.appData.notes = result.data;
            debouncedRenderNotesList();
            saveNotesToStorage();
            
            // Show success notification like products
            if (typeof window.showNotification === 'function') {
                window.showNotification(`Đã tải ${result.data.length} ghi chú từ Google Sheets!`);
            }
        } else {
            throw new Error(result.message || result.error || 'Không thể tải dữ liệu');
        }
    } catch (error) {
        console.error('Load notes failed:', error);
        if (typeof window.showNotification === 'function') {
            window.showNotification('Lỗi: ' + error.message, 'error');
        }
    }
}
window.loadNotesFromGoogleSheets = loadNotesFromGoogleSheets;

// Utilities to control from UI/Console if needed
window.syncNotesNow = async function() { 
    await refreshNotesFromSheets(true); 
    await syncNotesToGoogleSheetsWithRetry(); 
};
window.clearNotesCache = function() { 
    try { 
        // ⚠️ WARNING: This will clear ALL notes data!
        if (confirm('⚠️ CẢNH BÁO: Thao tác này sẽ xóa TẤT CẢ ghi chú!\n\nBạn có chắc chắn muốn tiếp tục?')) {
            localStorage.removeItem('pdc_app_data'); 
            // Cache cleared, reloading 
            setTimeout(() => location.reload(), 300); 
        }
    } catch {} 
};
window.cleanupNotes = cleanupDeletedNotes;

// Force sync all notes to Google Sheets
window.forceSyncAllNotes = async function() {
    console.log('🔄 Force syncing all notes to Google Sheets...');
    console.log('📊 Current notes:', window.appData.notes.length);
    console.log('📋 Notes data:', window.appData.notes);
    
    try {
        await syncNotesToGoogleSheets();
        console.log('✅ Force sync completed');
    } catch (error) {
        console.error('❌ Force sync failed:', error);
    }
};

// Force replace local notes with Google Sheets data
window.forceReplaceWithGoogleSheets = async function() {
    console.log('🔄 Force replacing local notes with Google Sheets data...');
    try {
        await refreshNotesFromSheets(true);
        console.log('✅ Local notes replaced with Google Sheets data');
    } catch (error) {
        console.error('❌ Force replace failed:', error);
    }
};

// Toggle additional fields based on note tag selection
function toggleNoteFields() {
    const tagSelect = document.getElementById('noteTagSelect');
    const additionalFields = document.getElementById('noteAdditionalFields');
    const infoFields = document.getElementById('noteInfoFields');
    
    if (!tagSelect || !additionalFields || !infoFields) return;
    
    if (tagSelect.value === 'chua-xu-ly') {
        additionalFields.style.display = 'block';
        infoFields.style.display = 'none';
        // Clear info fields when hiding
        const title = document.getElementById('noteTitle');
        if (title) title.value = '';
    } else if (tagSelect.value === 'note-thong-tin') {
        additionalFields.style.display = 'none';
        infoFields.style.display = 'block';
        // Clear additional fields when hiding
        const chatLink = document.getElementById('noteChatLink');
        const orderId = document.getElementById('noteOrderId');
        if (chatLink) chatLink.value = '';
        if (orderId) orderId.value = '';
    } else {
        additionalFields.style.display = 'none';
        infoFields.style.display = 'none';
        // Clear all fields when no selection
        const chatLink = document.getElementById('noteChatLink');
        const orderId = document.getElementById('noteOrderId');
        const title = document.getElementById('noteTitle');
        if (chatLink) chatLink.value = '';
        if (orderId) orderId.value = '';
        if (title) title.value = '';
    }
}

// Initialize form on page load
function initNoteForm() {
    // Set default to "Chưa xử lý" and show fields
    const tagSelect = document.getElementById('noteTagSelect');
    if (tagSelect) {
        tagSelect.value = 'chua-xu-ly';
        toggleNoteFields();
    }
}

window.toggleNoteFields = toggleNoteFields;
window.initNoteForm = initNoteForm;
// Periodic sync functions removed

// Search notes functionality
// Search notes functionality with debounce
let _searchTimeout = null;
const SEARCH_DEBOUNCE_MS = 300;

function searchNotes() {
    const searchInput = document.getElementById('notesSearchInput');
    if (!searchInput) return;
    
    // Clear previous timeout
    if (_searchTimeout) {
        clearTimeout(_searchTimeout);
    }
    
    // Debounce search
    _searchTimeout = setTimeout(() => {
        const searchTerm = searchInput.value.trim().toLowerCase();
        window.__notesSearchTerm = searchTerm;
        
        // Re-render notes list with search filter
        debouncedRenderNotesList();
    }, SEARCH_DEBOUNCE_MS);
}

function clearNotesSearch() {
    const searchInput = document.getElementById('notesSearchInput');
    if (searchInput) {
        searchInput.value = '';
        window.__notesSearchTerm = '';
        debouncedRenderNotesList();
    }
}

window.searchNotes = searchNotes;
window.clearNotesSearch = clearNotesSearch;

//

// Custom bulk delete confirmation modal
function showBulkDeleteConfirmation(count) {
    return new Promise((resolve) => {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'bulk-delete-modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        `;
        
        // Create modal content
        const modal = document.createElement('div');
        modal.className = 'bulk-delete-modal';
        modal.style.cssText = `
            background: #1f2937;
            border-radius: 12px;
            padding: 24px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease;
            border: 1px solid #374151;
        `;
        
        modal.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 48px; margin-bottom: 12px;">🗑️</div>
                <h3 style="color: #f9fafb; margin: 0 0 8px 0; font-size: 18px; font-weight: 600;">Xóa nhiều ghi chú</h3>
                <p style="color: #9ca3af; margin: 0; font-size: 14px;">Bạn có chắc chắn muốn xóa ${count} ghi chú đã chọn?</p>
            </div>
            
            <div style="background: #111827; border-radius: 8px; padding: 12px; margin-bottom: 20px; border: 1px solid #374151;">
                <div style="color: #fbbf24; font-weight: 500; margin-bottom: 4px;">⚠️ Cảnh báo</div>
                <div style="color: #d1d5db; font-size: 14px; line-height: 1.4;">Thao tác này không thể hoàn tác. Tất cả ghi chú đã chọn sẽ bị xóa vĩnh viễn.</div>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button class="cancel-btn" style="
                    background: #374151;
                    color: #f9fafb;
                    border: 1px solid #4b5563;
                    border-radius: 8px;
                    padding: 10px 20px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                ">Hủy</button>
                <button class="delete-btn" style="
                    background: #dc2626;
                    color: white;
                    border: 1px solid #dc2626;
                    border-radius: 8px;
                    padding: 10px 20px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                ">Xóa ${count} ghi chú</button>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideIn {
                from { transform: translateY(-20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .cancel-btn:hover {
                background: #4b5563 !important;
                border-color: #6b7280 !important;
            }
            .delete-btn:hover {
                background: #b91c1c !important;
                border-color: #b91c1c !important;
            }
        `;
        document.head.appendChild(style);
        
        // Add event listeners
        const cancelBtn = modal.querySelector('.cancel-btn');
        const deleteBtn = modal.querySelector('.delete-btn');
        
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            document.head.removeChild(style);
            resolve(false);
        });
        
        deleteBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            document.head.removeChild(style);
            resolve(true);
        });
        
        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                document.head.removeChild(style);
                resolve(false);
            }
        });
        
        // Add to DOM
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    });
}

// Old delete functions removed - using new custom modal

// Bulk actions for completed notes
function toggleSelectAllCompleted() {
    const selectAllCheckbox = document.getElementById('selectAllCompleted');
    const noteCheckboxes = document.querySelectorAll('.note-checkbox');
    
    noteCheckboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
    
    updateBulkActions();
}

function updateBulkActions() {
    const noteCheckboxes = document.querySelectorAll('.note-checkbox');
    const checkedBoxes = document.querySelectorAll('.note-checkbox:checked');
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    const selectAllCheckbox = document.getElementById('selectAllCompleted');
    
    if (deleteBtn) {
        deleteBtn.disabled = checkedBoxes.length === 0;
    }
    
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = noteCheckboxes.length > 0 && checkedBoxes.length === noteCheckboxes.length;
        selectAllCheckbox.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < noteCheckboxes.length;
    }
}

async function deleteSelectedCompleted() {
    const checkedBoxes = document.querySelectorAll('.note-checkbox:checked');
    if (checkedBoxes.length === 0) return;
    
    // Show custom bulk delete confirmation
    const confirmed = await showBulkDeleteConfirmation(checkedBoxes.length);
    if (!confirmed) return;
    
    try {
        const noteIds = Array.from(checkedBoxes).map(checkbox => checkbox.dataset.noteId);
        
        // Remove from local data
        window.appData.notes = window.appData.notes.filter(note => !noteIds.includes(note.id));
        
        // Update UI immediately
        renderNotesList();
        renderNotesCategories();
        saveNotesToStorage();
        
        // Sync to Google Sheets
        try {
            const url = (window.GAS_URL || '') + '?token=' + encodeURIComponent(window.GAS_TOKEN || '');
            const payload = { action: 'notesDelete', ids: noteIds };
            const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.success) {
                // Handle error silently
            }
        } catch (e) {
            // Handle error silently
        }
        
        // Simple notification like products
        showNotification(`Đã xóa ${noteIds.length} ghi chú!`, 'success');
    } catch (error) {
        // Handle error silently
        showNotification('Lỗi khi xóa ghi chú!', 'error');
    }
}

window.toggleSelectAllCompleted = toggleSelectAllCompleted;
window.updateBulkActions = updateBulkActions;
window.deleteSelectedCompleted = deleteSelectedCompleted;

// Notes notifications with stacking toast implementation
function showNotification(message, type = 'info', title = '') {
    console.log('🔔 showNotification called:', message, type);
    try {
        const normalized = (type === 'warning') ? 'error' : (type === 'info' ? 'success' : type);
        console.log('🔔 Normalized type:', normalized);
        
        // Get or create toast container
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                z-index: 10000;
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${normalized}`;
        toast.textContent = message;
        
        // Add styles
        Object.assign(toast.style, {
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            fontSize: '14px',
            maxWidth: '320px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease, opacity 0.3s ease',
            opacity: '0',
            pointerEvents: 'auto'
        });
        
        // Set background color based on type
        if (normalized === 'success') {
            toast.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        } else if (normalized === 'error') {
            toast.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        } else {
            toast.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
        }
        
        // Add to container (prepend so new appears on top)
        container.prepend(toast);
        
        // Limit to 5 toasts max
        const MAX_TOASTS = 5;
        const existingToasts = container.querySelectorAll('.toast-notification');
        if (existingToasts.length > MAX_TOASTS) {
            // Remove oldest toasts
            for (let i = MAX_TOASTS; i < existingToasts.length; i++) {
                existingToasts[i].remove();
            }
        }
        
        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity = '1';
        }, 10);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            toast.style.opacity = '0';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
        
        console.log('🔔 Toast created successfully');
    } catch (error) {
        console.error('🔔 showNotification error:', error);
    }
}


// Add event listener for modal overlay click
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('deleteNoteModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeDeleteModal();
            }
        });
    }
});

// Apply smart masonry layout
function applyMasonryLayout() {
    const masonry = document.querySelector('.notes-masonry');
    if (!masonry) return;
    
    // CSS columns will handle the layout automatically
    // No need to rearrange cards
}

window.applyMasonryLayout = applyMasonryLayout;

function scheduleRefreshNotes(delayMs) {
    setTimeout(() => { refreshNotesFromSheets(true); }, Math.max(0, delayMs || 0));
}

// ===== Lightweight local tag management (no DB) =====
const SAVED_TAGS_KEY = 'pdc_saved_tags_v1';
const SAVED_TAG_COLORS_KEY = 'pdc_saved_tag_colors_v1';
function loadSavedTags() {
    try {
        const raw = localStorage.getItem(SAVED_TAGS_KEY);
        const arr = raw ? JSON.parse(raw) : ['khachhang','noibo','gap','khac'];
        window.__savedTags = Array.isArray(arr) ? arr.filter(Boolean) : [];
    } catch { window.__savedTags = ['khachhang','noibo','gap','khac']; }
}
function loadSavedTagColors() {
    try {
        const raw = localStorage.getItem(SAVED_TAG_COLORS_KEY);
        const obj = raw ? JSON.parse(raw) : { khachhang:'#0b74c4', noibo:'#3b5bdb', gap:'#d9480f', khac:'#495057', all:'#3182ce' };
        window.__savedTagColors = obj || {};
    } catch { window.__savedTagColors = { khachhang:'#0b74c4', noibo:'#3b5bdb', gap:'#d9480f', khac:'#495057', all:'#3182ce' }; }
}
function saveSavedTagColors() {
    try { localStorage.setItem(SAVED_TAG_COLORS_KEY, JSON.stringify(window.__savedTagColors || {})); } catch {}
}
function saveSavedTags() {
    try { localStorage.setItem(SAVED_TAGS_KEY, JSON.stringify(window.__savedTags || [])); } catch {}
}
function renderSavedTagsUI() {
    const wrap = document.getElementById('savedTagsChips');
    if (!wrap) return;
    const tags = (window.__savedTags || []).slice(0, 50);
    wrap.innerHTML = tags.map(t => `<span class="chip" style="padding:4px 8px; border:1px solid var(--border-primary); border-radius:999px; cursor:pointer;">${t} <button type="button" style="margin-left:6px; border:none; background:transparent; cursor:pointer;" onclick="removeSavedTag('${t}')">×</button></span>`).join('');
}
function populateTagSelect() {
    const updateOne = (sel) => {
        if (!sel) return;
        const hasEmpty = sel.querySelector('option[value=""]');
        sel.innerHTML = '';
        if (hasEmpty) sel.appendChild(hasEmpty);
        const fixedTags = ['chua-xu-ly', 'note-thong-tin'];
        fixedTags.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = (t === 'chua-xu-ly') ? 'Chưa xử lý' : 'Note thông tin';
            sel.appendChild(opt);
        });
    };
    updateOne(document.getElementById('noteTagSelect'));
    updateOne(document.getElementById('modalTagSelect'));
}
window.addTagToSavedList = function() {
    try {
        const sel = document.getElementById('noteTagSelect');
        const custom = document.getElementById('noteTagsCustom');
        const fromSel = (sel?.value || '').trim().toLowerCase();
        const fromCustom = (custom?.value || '').trim().toLowerCase();
        const parts = [fromSel, fromCustom].filter(Boolean).join(',').split(',').map(s=>s.trim()).filter(Boolean);
        if (parts.length === 0) { showNotification('Nhập hoặc chọn tag để lưu', 'error'); return; }
        window.__savedTags = Array.from(new Set([...(window.__savedTags||[]), ...parts]));
        saveSavedTags(); populateTagSelect(); renderSavedTagsUI();
        showNotification('Đã lưu tag vào máy bạn', 'success');
    } catch {}
}
window.removeSavedTag = function(tag) {
    try {
        window.__savedTags = (window.__savedTags || []).filter(t => t !== tag);
        saveSavedTags(); populateTagSelect(); renderSavedTagsUI(); renderTagsManageList();
    } catch {}
}

//

// Edit note function
function editNote(noteId) {
    const note = window.appData.notes.find(n => n.id === noteId);
    if (!note) {
        showNotification('Không tìm thấy ghi chú!', 'error');
        return;
    }
    
    // Create edit modal
    showEditNoteModal(note);
}
window.editNote = editNote;

// Show edit note modal
function showEditNoteModal(note) {
    // Remove existing modal if any
    const existingModal = document.querySelector('.edit-note-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.className = 'edit-note-modal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeEditNoteModal()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h3>Chỉnh sửa ghi chú</h3>
                <button class="modal-close" onclick="closeEditNoteModal()">×</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Mã đơn hàng</label>
                    <input type="text" id="editOrderCode" class="form-input" value="${note.orderCode || ''}" placeholder="Nhập mã đơn hàng...">
                </div>
                <div class="form-group">
                    <label class="form-label">Link chat</label>
                    <input type="text" id="editChatLink" class="form-input" value="${note.chatLink || ''}" placeholder="Nhập link chat...">
                </div>
                <div class="form-group">
                    <label class="form-label">Tiêu đề</label>
                    <input type="text" id="editNoteTitle" class="form-input" value="${note.title || ''}" placeholder="Nhập tiêu đề...">
                </div>
                <div class="form-group">
                    <label class="form-label">Nội dung</label>
                    <textarea id="editNoteContent" class="form-textarea" rows="4" placeholder="Nhập nội dung ghi chú...">${note.content || ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Loại ghi chú</label>
                    <div class="note-type-options">
                        <label class="radio-option">
                            <input type="radio" name="noteType" value="chua-xu-ly" ${(note.tags || '').includes('chua-xu-ly') ? 'checked' : ''}>
                            <span class="radio-label">Chưa xử lý</span>
                        </label>
                        <label class="radio-option">
                            <input type="radio" name="noteType" value="note-thong-tin" ${(note.tags || '').includes('note-thong-tin') ? 'checked' : ''}>
                            <span class="radio-label">Note thông tin</span>
                        </label>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeEditNoteModal()">Hủy</button>
                <button class="btn btn-primary" onclick="saveEditNote('${note.id}')">Lưu</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    
    // Focus on first input
    setTimeout(() => {
        document.getElementById('editOrderCode').focus();
    }, 100);
}
window.showEditNoteModal = showEditNoteModal;

// Close edit note modal
function closeEditNoteModal() {
    const modal = document.querySelector('.edit-note-modal');
    if (modal) {
        modal.remove();
    }
}
window.closeEditNoteModal = closeEditNoteModal;

// Save edited note
function saveEditNote(noteId) {
    const note = window.appData.notes.find(n => n.id === noteId);
    if (!note) {
        showNotification('Không tìm thấy ghi chú!', 'error');
        return;
    }
    
    const orderCode = document.getElementById('editOrderCode').value.trim();
    const chatLink = document.getElementById('editChatLink').value.trim();
    const title = document.getElementById('editNoteTitle').value.trim();
    const content = document.getElementById('editNoteContent').value.trim();
    const noteType = document.querySelector('input[name="noteType"]:checked');
    const tags = noteType ? noteType.value : '';
    
    if (!content) {
        showNotification('Nhập nội dung ghi chú!', 'error');
        return;
    }
    
    // Update note
    note.orderCode = orderCode;
    note.chatLink = chatLink;
    note.title = title;
    note.content = content;
    note.tags = tags;
    note.updatedAt = new Date().toISOString();
    
    // Close modal
    closeEditNoteModal();
    
    // Re-render list
    renderNotesList();
    renderNotesCategories();
    
    // Save to localStorage
    saveNotesToStorage();
    
    // Sync to Google Sheets
    try { syncNotesToGoogleSheets(); } catch (e) { /* Handle error silently */ }
    
    // Trigger immediate real-time sync
    setTimeout(() => {
        try { refreshNotesFromSheets(true); } catch (e) { /* Handle error silently */ }
    }, 1000);
    
    showNotification('Đã cập nhật ghi chú!', 'success');
}
window.saveEditNote = saveEditNote;

// Format note date with detailed time for old notes
function formatNoteDateDetailed(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const noteDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    // If it's today, show time only
    if (noteDate.getTime() === today.getTime()) {
        return date.toLocaleTimeString('vi-VN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
    
    // If it's not today, show full date and time
    return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Scientific Filter System
let currentStatusFilter = 'pending';
let currentTimeFilter = 'all';
let currentSortOrder = 'newest';

// Apply scientific filter
function applyScientificFilter() {
    const notes = window.appData.notes || [];
    let filteredNotes = [...notes];
    
    // Apply status filter
    filteredNotes = filteredNotes.filter(note => {
        const isInfoNote = (note.tags || '').includes('note-thong-tin');
        const isCompleted = note.status === 'completed' || note.status === 'đã hoàn thành';
        
        switch (currentStatusFilter) {
            case 'pending':
                return !isCompleted && !isInfoNote;
            case 'info':
                return isInfoNote;
            case 'completed':
                return isCompleted;
            default:
                return true;
        }
    });
    
    // Apply time filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    filteredNotes = filteredNotes.filter(note => {
        const noteDate = new Date(note.createdAt);
        const noteDay = new Date(noteDate.getFullYear(), noteDate.getMonth(), noteDate.getDate());
        
        switch (currentTimeFilter) {
            case 'today':
                return noteDay.getTime() === today.getTime();
            case 'yesterday':
                return noteDay.getTime() === yesterday.getTime();
            default:
                return true;
        }
    });
    
    // Apply sorting
    switch (currentSortOrder) {
        case 'newest':
            filteredNotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            break;
        case 'oldest':
            filteredNotes.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            break;
        case 'alphabetical':
            filteredNotes.sort((a, b) => {
                const aTitle = (a.title || a.chatLink || '').toLowerCase();
                const bTitle = (b.title || b.chatLink || '').toLowerCase();
                return aTitle.localeCompare(bTitle);
            });
            break;
    }
    
    return filteredNotes;
}

// Render filtered notes with scientific approach
function renderScientificFilteredNotes() {
    const filteredNotes = applyScientificFilter();
    const container = document.getElementById('notesList');
    if (!container) return;
    
    // Show/hide bulk actions based on current status filter (completed)
    try {
        const bulkActionsContainer = document.getElementById('bulkActionsContainer');
        if (bulkActionsContainer) {
            bulkActionsContainer.style.display = (currentStatusFilter === 'completed') ? 'block' : 'none';
        }
    } catch {}
    
    if (filteredNotes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <h4>Không tìm thấy ghi chú</h4>
                <p>Thử thay đổi bộ lọc để xem thêm ghi chú</p>
            </div>
        `;
        return;
    }
    
    const cards = filteredNotes.map(note => {
        const isInfoNote = (note.tags || '').includes('note-thong-tin');
        let typeLabel, typeClass;
        
        if (note.status === 'completed' || note.status === 'đã hoàn thành') {
            typeLabel = 'Hoàn thành';
            typeClass = 'note-completed';
        } else if (isInfoNote) {
            typeLabel = 'Thông tin';
            typeClass = 'note-info';
        } else {
            typeLabel = 'Chưa xử lý';
            typeClass = 'note-pending';
        }
        
        let headerContent = '';
        if (isInfoNote) {
            const rawTitle = String(note.title || note.orderCode || '').trim();
            const fallback = String(note.content || '').split('\n')[0] || '';
            const titleToShow = (rawTitle || fallback || '');
            headerContent = `<div class="v3-title">${titleToShow.replace(/\n/g,'<br>')}</div>`;
        } else {
            // For "Chưa xử lý" - show order code and chat link
            const orderCode = String(note.orderCode || '').trim();
            const link = String(note.chatLink || '');
            const linkShort = link.length > 40 ? link.substring(0,40) + '…' : link;
            const linkTitle = linkShort || '—';
            
            // Only show order code if it's not a temporary code
            if (orderCode && !orderCode.startsWith('TEMP_')) {
                headerContent = `
                    <div class="v3-order-code">${orderCode}</div>
                    <a class="v3-link" href="${link}" target="_blank" title="Mở link chat">${linkTitle}</a>
                `;
            } else {
                headerContent = `<a class="v3-link" href="${link}" target="_blank" title="Mở link chat">${linkTitle}</a>`;
            }
        }
        
        const checkboxHtml = (note.status === 'completed' || note.status === 'đã hoàn thành') ? 
            `<input type="checkbox" class="note-checkbox" data-note-id="${note.id}" onchange="updateBulkActions()">` : '';
        
        let cardType = '';
        if (note.status === 'completed' || note.status === 'đã hoàn thành') {
            cardType = 'completed';
        } else if (isInfoNote) {
            cardType = 'note-thong-tin';
        }
        // For pending cards, cardType remains empty string - no special styling
        
        return `
        <div class="note-cardv3 ${typeClass}" id="note-${note.id}" data-note-id="${note.id}" data-type="${cardType}">
            ${checkboxHtml}
            <div class="v3-head">
                ${headerContent}
                <span class="v3-status ${typeClass}">${typeLabel}</span>
            </div>
            <div class="v3-body">${String(note.content || '').replace(/\n/g,'<br>')}</div>
            <div class="v3-foot">
                <span class="v3-time">${formatNoteDateDetailed(note.createdAt)}</span>
            </div>
            <div class="v3-actions">
                <button class="icon-btn" title="Chỉnh sửa" onclick="editNote('${note.id}')">✏️</button>
                ${(note.status === 'completed' || note.status === 'đã hoàn thành') ? '' : (isInfoNote ? '' : `<button class="icon-btn" title="Copy" onclick="copyNoteChatLink('${note.id}')">📋</button>`)}
                ${(note.status === 'completed' || note.status === 'đã hoàn thành') ? '' : `<button class="icon-btn ${isInfoNote ? 'delete' : 'ok'}" title="${isInfoNote ? 'Xóa note' : 'Hoàn thành'}" onclick="${isInfoNote ? 'deleteNote' : 'completeNote'}('${note.id}')">${isInfoNote ? '🗑️' : '✅'}</button>`}
            </div>
        </div>`;
    }).join('');
    
    container.innerHTML = `<div class="notes-masonry">${cards}</div>`;
    
    // Update select-all and delete button state after render
    try { updateBulkActions(); } catch {}
}

// Initialize scientific filter system
function initScientificFilter() {
    // Status filter buttons
    document.querySelectorAll('.filter-option[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-option[data-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentStatusFilter = btn.dataset.filter;
            renderScientificFilteredNotes();
        });
    });
    
    // Time filter buttons
    document.querySelectorAll('.filter-option[data-time]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-option[data-time]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTimeFilter = btn.dataset.time;
            renderScientificFilteredNotes();
        });
    });
    
    // Sort select
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSortOrder = e.target.value;
            renderScientificFilteredNotes();
        });
    }
}

// Simple render like products - no override needed

// Initialize scientific filter when module loads
setTimeout(() => {
    initScientificFilter();
}, 100);

// Masonry-like spanning for CSS Grid (LTR) so varying heights don't affect others
function relayoutNotesGrid() {
    const grid = document.querySelector('.notes-grid');
    if (!grid) return;
    // revert to default grid rows
    grid.querySelectorAll('.note-cardv3').forEach(card => {
        card.style.gridRowEnd = 'auto';
    });
}

// Recompute after renders and on resize
window.addEventListener('resize', () => requestAnimationFrame(relayoutNotesGrid));