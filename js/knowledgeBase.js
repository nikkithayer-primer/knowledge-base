// Knowledge Base display and management functionality
import { loadEntitiesFromFirebase, deleteEntityFromFirebase, deleteMultipleEntitiesFromFirebase } from './firebaseOperations.js';
import { escapeHtml } from './dataProcessor.js';
import { getFirebaseCollectionName } from './collectionMapping.js';

// Global knowledge base state
let knowledgeBaseData = {
    people: [],
    places: [],
    organizations: []
};

let filteredData = {
    people: [],
    places: [],
    organizations: []
};

// Export knowledge base data for duplicate checking
export function getKnowledgeBaseData() {
    return knowledgeBaseData;
}

// Load and display knowledge base
export async function loadKnowledgeBase() {
    const statsElement = document.getElementById('knowledgeBaseStats');
    const emptyState = document.getElementById('knowledgeBaseEmptyState');
    const content = document.getElementById('knowledgeBaseContent');
    
    try {
        statsElement.textContent = 'Loading knowledge base...';
        
        // Load all entity types from Firebase
        console.log('🔍 Knowledge Base: Starting to load entities from Firebase...');
        
        // Debug: Show what collections we're trying to load from
        const peopleCollection = getFirebaseCollectionName('people');
        const placesCollection = getFirebaseCollectionName('places');
        const organizationsCollection = getFirebaseCollectionName('organizations');
        
        console.log('📋 Collection names:', {
            people: peopleCollection,
            places: placesCollection,
            organizations: organizationsCollection
        });
        
        const [people, places, organizations] = await Promise.all([
            loadEntitiesFromFirebase(peopleCollection, 100),
            loadEntitiesFromFirebase(placesCollection, 100),
            loadEntitiesFromFirebase(organizationsCollection, 100)
        ]);
        
        console.log('📊 Knowledge Base loaded:', {
            people: people.length,
            places: places.length, 
            organizations: organizations.length,
            peopleData: people.map(p => ({ id: p.id, name: p.name })),
            placesData: places.map(p => ({ id: p.id, name: p.name })),
            organizationsData: organizations.map(o => ({ id: o.id, name: o.name }))
        });
        
        knowledgeBaseData = { people, places, organizations };
        filteredData = { ...knowledgeBaseData };
        
        const totalEntities = people.length + places.length + organizations.length;
        
        if (totalEntities === 0) {
            emptyState.style.display = 'block';
            content.style.display = 'none';
            statsElement.textContent = 'Knowledge base is empty';
        } else {
            emptyState.style.display = 'none';
            content.style.display = 'block';
            statsElement.textContent = `${totalEntities} entities: ${people.length} people, ${places.length} places, ${organizations.length} organizations`;
        }
        
        renderKnowledgeBase();
        updateKnowledgeBaseTab(totalEntities);
        
        console.log(`📚 Knowledge base loaded: ${totalEntities} total entities`);
                
    } catch (error) {
        console.error('Error loading knowledge base:', error);
        statsElement.textContent = `Error loading knowledge base: ${error.message}`;
        emptyState.style.display = 'block';
        content.style.display = 'none';
    }
}

// Render knowledge base sections
function renderKnowledgeBase() {
    // Update tab counts
    updateTabCounts();
    
    // Render all entity types
    renderEntityTab('people', filteredData.people);
    renderEntityTab('places', filteredData.places);
    renderEntityTab('organizations', filteredData.organizations);
    
    // Show/hide empty state based on current active tab
    updateEmptyState();
}

// Create entity table HTML
function createEntityTable(entities, entityType) {
    if (entities.length === 0) {
        return '<div class="kb-entity-list empty">No entities found</div>';
    }
    
    const columns = getTableColumns(entityType);
    
    let tableHTML = `
        <div class="kb-table-wrapper">
            <table class="kb-table">
                <thead>
                    <tr>
                        ${columns.map(col => `<th class="kb-th-${col.key}">${col.label}</th>`).join('')}
                        <th class="kb-th-actions">Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    entities.forEach((entity, index) => {
        tableHTML += `<tr class="${index % 2 === 0 ? 'even' : 'odd'}" data-entity-id="${entity.id}">`;
        
        columns.forEach(col => {
            const value = getEntityValue(entity, col.key);
            tableHTML += `<td class="kb-td-${col.key}">${value}</td>`;
        });
        
        // Actions column
        tableHTML += `
            <td class="kb-td-actions">
                <button type="button" class="kb-delete-btn-table" 
                        data-entity-type="${entityType}" 
                        data-entity-id="${entity.id}" 
                        data-entity-name="${escapeHtml(entity.name || 'Unnamed')}" 
                        title="Delete entity">
                    🗑️
                </button>
            </td>
        `;
        
        tableHTML += '</tr>';
    });
    
    tableHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    // Add event listeners for delete buttons
    setTimeout(() => {
        const deleteButtons = document.querySelectorAll('.kb-delete-btn-table');
        deleteButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const entityType = btn.dataset.entityType;
                const entityId = btn.dataset.entityId;
                const entityName = btn.dataset.entityName;
                handleDeleteEntity(entityType, entityId, entityName);
            });
        });
    }, 0);
    
    return tableHTML;
}

// Get table columns for each entity type
function getTableColumns(entityType) {
    const commonColumns = [
        { key: 'name', label: 'Name' },
        { key: 'description', label: 'Description' },
        { key: 'wikidata_id', label: 'Wikidata ID' }
    ];
    
    if (entityType === 'people') {
        return [
            ...commonColumns,
            { key: 'occupation', label: 'Occupation' },
            { key: 'currentEmployer', label: 'Current Employer' },
            { key: 'currentResidence', label: 'Location' },
            { key: 'dateOfBirth', label: 'Date of Birth' }
        ];
    } else if (entityType === 'places') {
        return [
            ...commonColumns,
            { key: 'category', label: 'Category' },
            { key: 'country', label: 'Country' },
            { key: 'population', label: 'Population' },
            { key: 'coordinates', label: 'Coordinates' }
        ];
    } else if (entityType === 'organizations') {
        return [
            ...commonColumns,
            { key: 'category', label: 'Category' },
            { key: 'industry', label: 'Industry' },
            { key: 'founded', label: 'Founded' },
            { key: 'location', label: 'Location' }
        ];
    }
    
    return commonColumns;
}

// Get formatted value for entity field
function getEntityValue(entity, key) {
    let value = entity[key];
    
    if (!value) {
        return '<span class="empty-value">—</span>';
    }
    
    // Special formatting for specific fields
    switch (key) {
        case 'name':
            return escapeHtml(value);
            
        case 'description':
            // Truncate long descriptions
            const truncated = value.length > 100 ? value.substring(0, 100) + '...' : value;
            return `<span title="${escapeHtml(value)}">${escapeHtml(truncated)}</span>`;
            
        case 'wikidata_id':
            return value ? `<a href="https://www.wikidata.org/wiki/${value}" target="_blank" class="wikidata-link">${value}</a>` : '<span class="empty-value">—</span>';
            
        case 'population':
            return typeof value === 'number' ? value.toLocaleString() : escapeHtml(value);
            
        case 'coordinates':
            if (value && value.lat && value.lng) {
                return `${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}`;
            }
            return '<span class="empty-value">—</span>';
            
        case 'aliases':
            if (Array.isArray(value) && value.length > 0) {
                const displayAliases = value.slice(0, 3); // Show max 3 aliases
                const aliasText = displayAliases.join(', ');
                const moreCount = value.length - displayAliases.length;
                return moreCount > 0 ? 
                    `<span title="${escapeHtml(value.join(', '))}">${escapeHtml(aliasText)} (+${moreCount} more)</span>` :
                    escapeHtml(aliasText);
            }
            return '<span class="empty-value">—</span>';
            
        default:
            return escapeHtml(String(value));
    }
}

// Render individual entity tab
function renderEntityTab(entityType, entities) {
    const listElement = document.getElementById(`${entityType}List`);
    
    if (entities.length === 0) {
        listElement.innerHTML = '<div class="kb-entity-list empty">No entities found</div>';
        listElement.className = 'kb-entity-list empty';
        return;
    }
    
    listElement.className = 'kb-entity-list';
    listElement.innerHTML = createEntityTable(entities, entityType);
}

// Update tab counts
function updateTabCounts() {
    const peopleTab = document.getElementById('peopleKBTab');
    const placesTab = document.getElementById('placesKBTab');
    const organizationsTab = document.getElementById('organizationsKBTab');
    
    if (peopleTab) {
        const count = filteredData.people.length;
        peopleTab.innerHTML = `👤 People ${count > 0 ? `(${count})` : ''}`;
        peopleTab.setAttribute('data-count', count);
    }
    
    if (placesTab) {
        const count = filteredData.places.length;
        placesTab.innerHTML = `📍 Places ${count > 0 ? `(${count})` : ''}`;
        placesTab.setAttribute('data-count', count);
    }
    
    if (organizationsTab) {
        const count = filteredData.organizations.length;
        organizationsTab.innerHTML = `🏢 Organizations ${count > 0 ? `(${count})` : ''}`;
        organizationsTab.setAttribute('data-count', count);
    }
}

// Update empty state based on active tab
function updateEmptyState() {
    const emptyState = document.getElementById('knowledgeBaseEmptyState');
    const content = document.getElementById('knowledgeBaseContent');
    const activeTab = document.querySelector('.kb-tab-button.active');
    
    if (!activeTab) return;
    
    const entityType = activeTab.dataset.entityType;
    const hasEntities = filteredData[entityType] && filteredData[entityType].length > 0;
    
    if (hasEntities) {
        emptyState.style.display = 'none';
        content.style.display = 'block';
    } else {
        emptyState.style.display = 'block';
        content.style.display = 'none';
    }
}

// Switch between entity type tabs
function switchEntityTab(entityType) {
    // Update tab buttons
    document.querySelectorAll('.kb-tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`${entityType}KBTab`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.kb-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${entityType}KBContent`).classList.add('active');
    
    // Update empty state
    updateEmptyState();
}

// Create entity card HTML
function createEntityCard(entity, entityType) {
    const wikidataLink = entity.wikidata_id ? 
        `<a href="https://www.wikidata.org/wiki/${entity.wikidata_id}" target="_blank" class="kb-entity-wikidata">${entity.wikidata_id}</a>` : 
        '';
    
    const aliases = entity.aliases && entity.aliases.length > 0 ? 
        `<div class="kb-aliases">${entity.aliases.map(alias => `<span class="kb-alias">${escapeHtml(alias)}</span>`).join('')}</div>` : 
        '';
    
    const card = document.createElement('div');
    card.className = 'kb-entity-item';
    card.setAttribute('data-entity-type', entityType);
    card.setAttribute('data-entity-id', entity.id);
    
    card.innerHTML = `
        <div class="kb-entity-header">
            <h4 class="kb-entity-name">${escapeHtml(entity.name || 'Unnamed')}</h4>
            <div class="kb-entity-meta">
                <div class="kb-entity-id">${escapeHtml(entity.id || '')}</div>
                ${wikidataLink}
            </div>
            <div class="kb-entity-actions">
                <button type="button" class="kb-delete-btn" data-entity-type="${entityType}" data-entity-id="${entity.id}" data-entity-name="${escapeHtml(entity.name || 'Unnamed')}" title="Delete entity">
                    🗑️
                </button>
            </div>
        </div>
        
        ${entity.description ? `<p class="kb-entity-description">${escapeHtml(entity.description)}</p>` : ''}
        
        ${aliases}
        
        <div class="kb-entity-details">
            ${createEntityDetails(entity, entityType)}
        </div>
    `;
    
    // Add delete button event listener
    const deleteBtn = card.querySelector('.kb-delete-btn');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleDeleteEntity(entityType, entity.id, entity.name || 'Unnamed');
    });
    
    return card;
}

// Create entity-specific details
function createEntityDetails(entity, entityType) {
    if (entityType === 'people') {
        return `
            <div class="kb-detail-item">
                <div class="kb-detail-label">Occupation</div>
                <div class="kb-detail-value ${entity.occupation ? '' : 'empty'}">
                    ${entity.occupation || 'Not specified'}
                </div>
            </div>
            <div class="kb-detail-item">
                <div class="kb-detail-label">Current Employer</div>
                <div class="kb-detail-value ${entity.currentEmployer ? '' : 'empty'}">
                    ${entity.currentEmployer || 'Not specified'}
                </div>
            </div>
            <div class="kb-detail-item">
                <div class="kb-detail-label">Location</div>
                <div class="kb-detail-value ${entity.currentResidence ? '' : 'empty'}">
                    ${entity.currentResidence || 'Not specified'}
                </div>
            </div>
            <div class="kb-detail-item">
                <div class="kb-detail-label">Date of Birth</div>
                <div class="kb-detail-value ${entity.dateOfBirth ? '' : 'empty'}">
                    ${entity.dateOfBirth || 'Not specified'}
                </div>
            </div>
        `;
    } else if (entityType === 'places') {
        return `
            <div class="kb-detail-item">
                <div class="kb-detail-label">Category</div>
                <div class="kb-detail-value ${entity.category ? '' : 'empty'}">
                    ${entity.category || 'Not specified'}
                </div>
            </div>
            <div class="kb-detail-item">
                <div class="kb-detail-label">Country</div>
                <div class="kb-detail-value ${entity.country ? '' : 'empty'}">
                    ${entity.country || 'Not specified'}
                </div>
            </div>
            <div class="kb-detail-item">
                <div class="kb-detail-label">Population</div>
                <div class="kb-detail-value ${entity.population ? '' : 'empty'}">
                    ${entity.population ? entity.population.toLocaleString() : 'Not specified'}
                </div>
            </div>
            <div class="kb-detail-item">
                <div class="kb-detail-label">Coordinates</div>
                <div class="kb-detail-value ${entity.coordinates ? '' : 'empty'}">
                    ${entity.coordinates ? 
                        `${entity.coordinates.lat.toFixed(4)}, ${entity.coordinates.lng.toFixed(4)}` : 
                        'Not specified'
                    }
                </div>
            </div>
        `;
    } else if (entityType === 'organizations') {
        return `
            <div class="kb-detail-item">
                <div class="kb-detail-label">Category</div>
                <div class="kb-detail-value ${entity.category ? '' : 'empty'}">
                    ${entity.category || 'Not specified'}
                </div>
            </div>
            <div class="kb-detail-item">
                <div class="kb-detail-label">Industry</div>
                <div class="kb-detail-value ${entity.industry ? '' : 'empty'}">
                    ${entity.industry || 'Not specified'}
                </div>
            </div>
            <div class="kb-detail-item">
                <div class="kb-detail-label">Founded</div>
                <div class="kb-detail-value ${entity.founded ? '' : 'empty'}">
                    ${entity.founded || 'Not specified'}
                </div>
            </div>
            <div class="kb-detail-item">
                <div class="kb-detail-label">Location</div>
                <div class="kb-detail-value ${entity.location ? '' : 'empty'}">
                    ${entity.location || 'Not specified'}
                </div>
            </div>
        `;
    }
    
    return '';
}

// Filter knowledge base by search term
function filterBySearchTerm(searchTerm) {
    if (!searchTerm.trim()) {
        // Reset to full data
        filteredData = { ...knowledgeBaseData };
    } else {
        // Filter all entity types by search term
        const term = searchTerm.toLowerCase();
        filteredData = {
            people: knowledgeBaseData.people.filter(entity => matchesSearch(entity, term)),
            places: knowledgeBaseData.places.filter(entity => matchesSearch(entity, term)),
            organizations: knowledgeBaseData.organizations.filter(entity => matchesSearch(entity, term))
        };
    }
    
    renderKnowledgeBase();
}


// Check if entity matches search term
function matchesSearch(entity, term) {
    // Search in name
    if (entity.name && entity.name.toLowerCase().includes(term)) return true;
    
    // Search in description
    if (entity.description && entity.description.toLowerCase().includes(term)) return true;
    
    // Search in aliases
    if (entity.aliases && entity.aliases.some(alias => alias.toLowerCase().includes(term))) return true;
    
    // Search in type-specific fields
    if (entity.occupation && entity.occupation.toLowerCase().includes(term)) return true;
    if (entity.currentEmployer && entity.currentEmployer.toLowerCase().includes(term)) return true;
    if (entity.country && entity.country.toLowerCase().includes(term)) return true;
    if (entity.category && entity.category.toLowerCase().includes(term)) return true;
    if (entity.industry && entity.industry.toLowerCase().includes(term)) return true;
    if (entity.location && entity.location.toLowerCase().includes(term)) return true;
    
    return false;
}

// Update knowledge base tab with count
function updateKnowledgeBaseTab(count) {
    const knowledgeBaseTab = document.getElementById('knowledgeBaseTab');
    
    if (count > 0) {
        knowledgeBaseTab.textContent = `Knowledge Base (${count})`;
        knowledgeBaseTab.setAttribute('data-has-data', 'true');
    } else {
        knowledgeBaseTab.textContent = 'Knowledge Base';
        knowledgeBaseTab.removeAttribute('data-has-data');
    }
}

// Get knowledge base statistics
export function getKnowledgeBaseStats() {
    return {
        total: knowledgeBaseData.people.length + knowledgeBaseData.places.length + knowledgeBaseData.organizations.length,
        people: knowledgeBaseData.people.length,
        places: knowledgeBaseData.places.length,
        organizations: knowledgeBaseData.organizations.length
    };
}


// Initialize knowledge base event listeners
export function initializeKnowledgeBaseListeners() {
    const searchFilter = document.getElementById('searchFilter');
    const refreshBtn = document.getElementById('refreshKBBtn');
    
    // Tab button listeners
    const peopleTab = document.getElementById('peopleKBTab');
    const placesTab = document.getElementById('placesKBTab');
    const organizationsTab = document.getElementById('organizationsKBTab');
    
    if (peopleTab) {
        peopleTab.addEventListener('click', () => switchEntityTab('people'));
    }
    if (placesTab) {
        placesTab.addEventListener('click', () => switchEntityTab('places'));
    }
    if (organizationsTab) {
        organizationsTab.addEventListener('click', () => switchEntityTab('organizations'));
    }
    
    // Search listener
    if (searchFilter) {
        searchFilter.addEventListener('input', (e) => {
            filterBySearchTerm(e.target.value);
        });
    }
    
    // Refresh listener
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            // Reset search
            if (searchFilter) searchFilter.value = '';
            // Reload data
            loadKnowledgeBase();
        });
    }
}

// Handle delete entity with confirmation
export async function handleDeleteEntity(entityType, entityId, entityName) {
    const confirmed = await showConfirmationDialog(
        'Delete Entity',
        `Are you sure you want to delete "${entityName}"? This action cannot be undone.`,
        'Delete',
        'danger'
    );
    
    if (!confirmed) return;
    
    try {
        // Show loading state
        const entityCard = document.querySelector(`[data-entity-id="${entityId}"]`);
        if (entityCard) {
            entityCard.style.opacity = '0.5';
            entityCard.style.pointerEvents = 'none';
        }
        
        // Map entity type to correct Firebase collection name
        const collectionName = getFirebaseCollectionName(entityType);
        
        // Delete from Firebase
        await deleteEntityFromFirebase(collectionName, entityId);
        
        // Remove from local state
        if (knowledgeBaseData[entityType]) {
            knowledgeBaseData[entityType] = knowledgeBaseData[entityType].filter(entity => entity.id !== entityId);
            filteredData[entityType] = filteredData[entityType].filter(entity => entity.id !== entityId);
        }
        
        // Re-render the knowledge base
        renderKnowledgeBase();
        
        // Update stats
        const stats = getKnowledgeBaseStats();
        updateKnowledgeBaseTab(stats.total);
        
        const statsElement = document.getElementById('knowledgeBaseStats');
        if (statsElement) {
            statsElement.textContent = `${stats.total} entities: ${stats.people} people, ${stats.places} places, ${stats.organizations} organizations`;
        }
        
        console.log(`✅ Successfully deleted ${entityType} entity: ${entityName}`);
        
    } catch (error) {
        console.error('Error deleting entity:', error);
        
        // Restore card state on error
        const entityCard = document.querySelector(`[data-entity-id="${entityId}"]`);
        if (entityCard) {
            entityCard.style.opacity = '1';
            entityCard.style.pointerEvents = 'auto';
        }
        
        showErrorDialog('Delete Failed', `Failed to delete "${entityName}". Please try again.`);
    }
}

// Show confirmation dialog
function showConfirmationDialog(title, message, confirmText = 'Confirm', type = 'primary') {
    return new Promise((resolve) => {
        // Create modal backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = `modal confirmation-modal ${type}`;
        
        modal.innerHTML = `
            <div class="modal-header">
                <h3 class="modal-title">${escapeHtml(title)}</h3>
            </div>
            <div class="modal-body">
                <p class="modal-message">${escapeHtml(message)}</p>
            </div>
            <div class="modal-footer">
                <button type="button" class="modal-btn cancel-btn">Cancel</button>
                <button type="button" class="modal-btn confirm-btn ${type}">${escapeHtml(confirmText)}</button>
            </div>
        `;
        
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
        
        // Focus the confirm button
        const confirmBtn = modal.querySelector('.confirm-btn');
        const cancelBtn = modal.querySelector('.cancel-btn');
        
        // Handle confirm
        confirmBtn.addEventListener('click', () => {
            document.body.removeChild(backdrop);
            resolve(true);
        });
        
        // Handle cancel
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(backdrop);
            resolve(false);
        });
        
        // Handle escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', handleEscape);
                document.body.removeChild(backdrop);
                resolve(false);
            }
        };
        document.addEventListener('keydown', handleEscape);
        
        // Handle backdrop click
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                document.body.removeChild(backdrop);
                resolve(false);
            }
        });
        
        // Focus confirm button after a short delay
        setTimeout(() => confirmBtn.focus(), 100);
    });
}

// Show error dialog
function showErrorDialog(title, message) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    
    const modal = document.createElement('div');
    modal.className = 'modal error-modal';
    
    modal.innerHTML = `
        <div class="modal-header">
            <h3 class="modal-title">${escapeHtml(title)}</h3>
        </div>
        <div class="modal-body">
            <p class="modal-message">${escapeHtml(message)}</p>
        </div>
        <div class="modal-footer">
            <button type="button" class="modal-btn primary-btn">OK</button>
        </div>
    `;
    
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    
    const okBtn = modal.querySelector('.primary-btn');
    okBtn.addEventListener('click', () => {
        document.body.removeChild(backdrop);
    });
    
    // Handle escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            document.removeEventListener('keydown', handleEscape);
            document.body.removeChild(backdrop);
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Handle backdrop click
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            document.body.removeChild(backdrop);
        }
    });
    
    setTimeout(() => okBtn.focus(), 100);
}