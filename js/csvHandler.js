// CSV handling functionality
import { showStatus } from './ui.js';

// Expected CSV columns (support both singular and plural forms)
const EXPECTED_COLUMNS = [
    'Actor',
    'Action', 
    'Target',
    'Sentence',
    'Date Received',
    'Locations',
    'Datetimes' // Updated to match your CSV format
];

// Alternative column names for flexibility
const COLUMN_ALIASES = {
    'Datetime': 'Datetimes',
    'Datetimes': 'Datetimes'
};

// Parse CSV content into structured data
export function parseCSV(csvContent) {
    try {
        const lines = csvContent.trim().split('\n');
        
        if (lines.length < 2) {
            throw new Error('CSV must contain at least a header row and one data row');
        }
        
        // Parse header
        const header = parseCSVLine(lines[0]);
        validateHeader(header);
        
        // Parse data rows
        const data = [];
        let totalRowsProcessed = 0;
        let skippedRows = 0;
        
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) { // Skip empty lines
                totalRowsProcessed++;
                const row = parseCSVLine(lines[i]);
                
                if (row.length !== header.length) {
                    console.warn(`Row ${i + 1} has ${row.length} columns, expected ${header.length}. Row content:`, row);
                    skippedRows++;
                    continue;
                }
                
                // Create object with proper column mapping
                const rowData = {};
                header.forEach((col, index) => {
                    rowData[col] = row[index] || '';
                });
                
                
                // Validate and process the row
                const processedRow = processRow(rowData, i + 1);
                if (processedRow) {
                    data.push(processedRow);
                } else {
                    console.warn(`❌ Row ${i + 1} was rejected during processing`);
                    skippedRows++;
                }
            }
        }
        
        
        if (data.length === 0) {
            throw new Error('No valid data rows found in CSV');
        }
        
        return {
            success: true,
            data: data,
            totalRows: data.length,
            columns: header
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message,
            data: [],
            totalRows: 0
        };
    }
}

// Parse a single CSV line, handling quoted fields
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < line.length) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                // Escaped quote
                current += '"';
                i += 2;
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
                i++;
            }
        } else if (char === ',' && !inQuotes) {
            // Field separator
            result.push(current.trim());
            current = '';
            i++;
        } else {
            current += char;
            i++;
        }
    }
    
    // Add the last field
    result.push(current.trim());
    
    return result;
}

// Validate CSV header against expected columns
function validateHeader(header) {
    const normalizedHeader = header.map(col => col.trim().replace(/"/g, '')); // Remove quotes
    
    // Check if all expected columns are present (case-insensitive, with alias support)
    for (const expectedCol of EXPECTED_COLUMNS) {
        const found = normalizedHeader.some(col => {
            const colLower = col.toLowerCase();
            const expectedLower = expectedCol.toLowerCase();
            
            // Check exact match or alias match
            return colLower === expectedLower || 
                   (expectedCol === 'Datetimes' && colLower === 'datetime') ||
                   (expectedCol === 'Datetimes' && colLower === 'datetimes');
        });
        
        if (!found) {
            throw new Error(`Missing required column: "${expectedCol}" (also accepts "Datetime")`);
        }
    }
    
    // Normalize header to match expected format
    return normalizedHeader.map(col => {
        const colLower = col.toLowerCase();
        
        // Map to standard column names
        if (colLower === 'datetime' || colLower === 'datetimes') {
            return 'Datetimes';
        }
        
        const expectedCol = EXPECTED_COLUMNS.find(expected => 
            expected.toLowerCase() === colLower
        );
        return expectedCol || col;
    });
}

// Process and validate a single row
function processRow(rowData, rowNumber) {
    try {
        // Validate required fields
        const requiredFields = ['Actor', 'Action', 'Sentence'];
        const missingFields = [];
        
        for (const field of requiredFields) {
            const value = rowData[field];
            if (!value || value.trim() === '') {
                missingFields.push(field);
            }
        }
        
        if (missingFields.length > 0) {
            console.warn(`Row ${rowNumber}: Missing required fields: [${missingFields.join(', ')}]. Row data:`, rowData);
            return null;
        }
        
        // Process and validate datetime fields
        const processedRow = {
            ...rowData,
            Actor: (rowData.Actor || '').trim().replace(/^"|"$/g, ''), // Remove surrounding quotes
            Action: (rowData.Action || '').trim().replace(/^"|"$/g, ''),
            Target: (rowData.Target || '').trim().replace(/^"|"$/g, ''),
            Sentence: (rowData.Sentence || '').trim().replace(/^"|"$/g, ''),
            'Date Received': (rowData['Date Received'] || '').trim().replace(/^"|"$/g, ''),
            Locations: (rowData.Locations || '').trim().replace(/^"|"$/g, ''),
            Datetimes: (rowData.Datetimes || '').trim().replace(/^"|"$/g, ''),
            _rowNumber: rowNumber,
            _id: `csv_row_${rowNumber}_${Date.now()}`
        };
        
        // Validate date formats if provided
        if (processedRow['Date Received']) {
            const dateReceived = new Date(processedRow['Date Received']);
            if (isNaN(dateReceived.getTime())) {
                console.warn(`Row ${rowNumber}: Invalid "Date Received" format. Keeping original value.`);
            }
        }
        
        if (processedRow.Datetimes) {
            const datetime = new Date(processedRow.Datetimes);
            if (isNaN(datetime.getTime())) {
                console.warn(`Row ${rowNumber}: Invalid "Datetimes" format. Keeping original value.`);
            }
        }
        
        return processedRow;
        
    } catch (error) {
        console.warn(`Row ${rowNumber}: Error processing row - ${error.message}. Skipping.`);
        return null;
    }
}

// Create HTML table from CSV data
export function createCSVTable(csvData) {
    if (!csvData || !csvData.data || csvData.data.length === 0) {
        return '<p class="no-data">No data to display</p>';
    }
    
    const columns = EXPECTED_COLUMNS;
    const data = csvData.data;
    const duplicates = csvData.duplicates || new Map();
    const newEntities = csvData.newEntities || new Map();
    
    // Count duplicates and new entities for info display
    const duplicateCount = duplicates.size;
    const newEntityCount = newEntities.size;
    
    let tableHTML = `
        <div class="table-info">
            <p><strong>${data.length}</strong> rows loaded</p>
            ${duplicateCount > 0 ? `<p class="duplicate-info">🔍 <strong>${duplicateCount}</strong> entities already exist in knowledge base</p>` : ''}
            ${newEntityCount > 0 ? `<p class="new-entity-info">✨ <strong>${newEntityCount}</strong> new entities found - review to add to knowledge base</p>` : ''}
        </div>
        <div class="table-wrapper">
            <table class="csv-table">
                <thead>
                    <tr>
    `;
    
    // Add header columns
    columns.forEach(column => {
        tableHTML += `<th>${escapeHtml(column)}</th>`;
    });
    
    tableHTML += `
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Add data rows
    data.forEach((row, index) => {
        // Check if any entities in this row are duplicates
        const rowEntities = [row.Actor, row.Target, ...(row.Locations ? row.Locations.split(',') : [])];
        const hasDuplicate = rowEntities.some(entity => 
            entity && duplicates.has(entity.trim().toLowerCase())
        );
        
        // Use standard row styling - duplicates will be highlighted at cell level
        const rowClass = index % 2 === 0 ? 'even' : 'odd';
        tableHTML += `<tr class="${rowClass}">`;
        
        columns.forEach(column => {
            const value = row[column] || '';
            let processedValue = value;
            
            // Check if this cell contains entities (duplicates or new) and wrap in span
            if (column === 'Actor' || column === 'Target' || column === 'Locations') {
                if (column === 'Locations' && value) {
                    // Handle multiple locations
                    const locations = value.split(',');
                    const processedLocations = locations.map(location => {
                        const trimmedLocation = location.trim();
                        if (duplicates.has(trimmedLocation.toLowerCase())) {
                            const dupInfo = duplicates.get(trimmedLocation.toLowerCase());
                            const dupInfoJson = escapeHtml(JSON.stringify(dupInfo));
                            return `<span class="duplicate-entity" data-duplicate-info="${dupInfoJson}" title="Click to view knowledge base entry">${escapeHtml(trimmedLocation)}</span>`;
                        } else if (newEntities.has(trimmedLocation.toLowerCase())) {
                            const newEntityInfo = newEntities.get(trimmedLocation.toLowerCase());
                            const entityInfoJson = escapeHtml(JSON.stringify(newEntityInfo));
                            return `<span class="new-entity" data-entity-info="${entityInfoJson}" title="Click to review and approve">${escapeHtml(trimmedLocation)}</span>`;
                        }
                        return escapeHtml(trimmedLocation);
                    });
                    processedValue = processedLocations.join(', ');
                } else if (value && duplicates.has(value.trim().toLowerCase())) {
                    // Handle single duplicate entity (Actor or Target)
                    const dupInfo = duplicates.get(value.trim().toLowerCase());
                    const dupInfoJson = escapeHtml(JSON.stringify(dupInfo));
                    processedValue = `<span class="duplicate-entity" data-duplicate-info="${dupInfoJson}" title="Click to view knowledge base entry">${escapeHtml(value)}</span>`;
                } else if (value && newEntities.has(value.trim().toLowerCase())) {
                    // Handle single new entity (Actor or Target)
                    const newEntityInfo = newEntities.get(value.trim().toLowerCase());
                    const entityInfoJson = escapeHtml(JSON.stringify(newEntityInfo));
                    processedValue = `<span class="new-entity" data-entity-info="${entityInfoJson}" title="Click to review and approve">${escapeHtml(value)}</span>`;
                } else {
                    processedValue = escapeHtml(value);
                }
            } else {
                processedValue = escapeHtml(value);
            }
            
            tableHTML += `<td>${processedValue}</td>`;
        });
        
        tableHTML += '</tr>';
    });
    
    tableHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    return tableHTML;
}

// Initialize entity click handlers after table is rendered
export function initializeDuplicateHandlers() {
    // Remove any existing popover
    const existingPopover = document.querySelector('.kb-popover');
    if (existingPopover) {
        existingPopover.remove();
    }
    
    // Add click handlers to duplicate entities
    document.querySelectorAll('.duplicate-entity').forEach(span => {
        span.addEventListener('click', handleDuplicateEntityClick);
    });
    
    // Add click handlers to new entities
    document.querySelectorAll('.new-entity').forEach(span => {
        span.addEventListener('click', handleNewEntityClick);
    });
    
    // Close popover when clicking outside
    document.addEventListener('click', handleDocumentClick);
}

// Handle click on duplicate entity
function handleDuplicateEntityClick(event) {
    event.stopPropagation();
    
    const span = event.target;
    const duplicateInfo = JSON.parse(span.getAttribute('data-duplicate-info'));
    
    // Remove any existing popover
    const existingPopover = document.querySelector('.kb-popover');
    if (existingPopover) {
        existingPopover.remove();
    }
    
    // Create and show popover
    const popover = createKnowledgeBasePopover(duplicateInfo);
    document.body.appendChild(popover);
    
    // Position popover near the clicked element
    positionPopover(popover, span);
    
    // Show popover with animation
    setTimeout(() => {
        popover.classList.add('show');
    }, 10);
}

// Create knowledge base popover HTML
function createKnowledgeBasePopover(duplicateInfo) {
    const popover = document.createElement('div');
    popover.className = 'kb-popover';
    
    const entity = duplicateInfo.kbEntity;
    const matchType = duplicateInfo.matchType;
    
    popover.innerHTML = `
        <div class="kb-popover-header">
            <h3 class="kb-popover-title">${escapeHtml(entity.name)}<span class="kb-popover-match-type">${matchType} match</span></h3>
            <button class="kb-popover-close" type="button">&times;</button>
        </div>
        <div class="kb-popover-content">
            ${entity.id ? `<div class="kb-popover-field">
                <span class="kb-popover-label">ID:</span>
                <span class="kb-popover-value">${escapeHtml(entity.id)}</span>
            </div>` : ''}
            ${entity.description ? `<div class="kb-popover-field">
                <span class="kb-popover-label">Description:</span>
                <span class="kb-popover-value">${escapeHtml(entity.description)}</span>
            </div>` : ''}
            ${entity.occupation ? `<div class="kb-popover-field">
                <span class="kb-popover-label">Occupation:</span>
                <span class="kb-popover-value">${escapeHtml(entity.occupation)}</span>
            </div>` : ''}
            ${entity.category ? `<div class="kb-popover-field">
                <span class="kb-popover-label">Category:</span>
                <span class="kb-popover-value">${escapeHtml(entity.category)}</span>
            </div>` : ''}
            ${entity.country ? `<div class="kb-popover-field">
                <span class="kb-popover-label">Country:</span>
                <span class="kb-popover-value">${escapeHtml(entity.country)}</span>
            </div>` : ''}
            ${entity.location ? `<div class="kb-popover-field">
                <span class="kb-popover-label">Location:</span>
                <span class="kb-popover-value">${escapeHtml(entity.location)}</span>
            </div>` : ''}
            ${entity.wikidata_id ? `<div class="kb-popover-field">
                <span class="kb-popover-label">Wikidata:</span>
                <span class="kb-popover-value"><a href="https://www.wikidata.org/wiki/${escapeHtml(entity.wikidata_id)}" target="_blank" class="wikidata-link">${escapeHtml(entity.wikidata_id)}</a></span>
            </div>` : ''}
            ${entity.aliases && entity.aliases.length > 0 ? `<div class="kb-popover-field">
                <span class="kb-popover-label">Aliases:</span>
                <span class="kb-popover-value">${entity.aliases.map(alias => escapeHtml(alias)).join(', ')}</span>
            </div>` : ''}
        </div>
    `;
    
    // Add close button handler
    const closeBtn = popover.querySelector('.kb-popover-close');
    closeBtn.addEventListener('click', () => {
        popover.classList.remove('show');
        setTimeout(() => {
            if (popover.parentNode) {
                popover.parentNode.removeChild(popover);
            }
        }, 200);
    });
    
    return popover;
}

// Position popover near the clicked element
function positionPopover(popover, target) {
    const targetRect = target.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    
    // Position below the target by default
    let top = targetRect.bottom + window.scrollY + 8;
    let left = targetRect.left + window.scrollX;
    
    // Adjust if popover would go off screen
    if (left + popoverRect.width > window.innerWidth) {
        left = window.innerWidth - popoverRect.width - 10;
    }
    
    if (left < 10) {
        left = 10;
    }
    
    // If popover would go below viewport, position above target
    if (top + popoverRect.height > window.innerHeight + window.scrollY) {
        top = targetRect.top + window.scrollY - popoverRect.height - 8;
    }
    
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
}

// Handle clicks outside popover to close it
function handleDocumentClick(event) {
    const popover = document.querySelector('.kb-popover.show');
    if (popover && !popover.contains(event.target) && !event.target.classList.contains('duplicate-entity')) {
        popover.classList.remove('show');
        setTimeout(() => {
            if (popover.parentNode) {
                popover.parentNode.removeChild(popover);
            }
        }, 200);
    }
}

// Handle click on new entity
function handleNewEntityClick(event) {
    event.stopPropagation();
    
    const span = event.target;
    const entityInfo = JSON.parse(span.getAttribute('data-entity-info'));
    
    
    // Open the approval modal
    openApprovalModal(entityInfo);
}

// Open approval modal for new entity
function openApprovalModal(entityInfo) {
    // Remove any existing modal
    const existingModal = document.querySelector('.approval-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = createApprovalModal(entityInfo);
    document.body.appendChild(modal);
    
    // Show the modal
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
    
    // Prevent body scrolling
    document.body.style.overflow = 'hidden';
}

// Create approval modal HTML
function createApprovalModal(entityInfo) {
    const modal = document.createElement('div');
    modal.className = 'approval-modal modal-overlay';
    
    const entity = entityInfo.entity;
    const originalName = entityInfo.originalName;
    
    let modalContent = '';
    
    if (entity) {
        // Entity was found in Wikidata
        modalContent = `
            <div class="modal-container approval-modal-container">
                <div class="modal-header">
                    <h2>Review Entity</h2>
                    <button type="button" class="close-modal-btn approval-close">&times;</button>
                </div>
                
                <div class="modal-content">
                    <div class="approval-entity-info">
                        <div class="entity-type-badge ${entity.type}">${entity.type}</div>
                        <h3 class="entity-name">${escapeHtml(entity.name)}</h3>
                        <div class="original-name">Originally: "${escapeHtml(originalName)}"</div>
                        
                        ${entity.wikidata_id ? `<div class="wikidata-id">Wikidata ID: ${entity.wikidata_id}</div>` : ''}
                        ${entity.description ? `<div class="entity-description">${escapeHtml(entity.description)}</div>` : ''}
                    </div>
                    
                    <div class="entity-details">
                        ${createEntityDetailsForModal(entity)}
                    </div>
                    
                    <div class="approval-actions">
                        <button type="button" class="approve-btn" data-action="approve">
                            ✓ Approve & Add to Knowledge Base
                        </button>
                        <button type="button" class="reject-btn" data-action="reject">
                            ✗ Reject
                        </button>
                    </div>
                </div>
            </div>
        `;
    } else {
        // Unknown entity - not found in Wikidata
        modalContent = `
            <div class="modal-container approval-modal-container">
                <div class="modal-header">
                    <h2>Unknown Entity</h2>
                    <button type="button" class="close-modal-btn approval-close">&times;</button>
                </div>
                
                <div class="modal-content">
                    <div class="approval-entity-info">
                        <div class="entity-type-badge unknown">Unknown</div>
                        <h3 class="entity-name">${escapeHtml(originalName)}</h3>
                        <div class="unknown-reason">Not found in Wikidata</div>
                    </div>
                    
                    <div class="approval-actions">
                        <button type="button" class="map-btn" data-action="map">
                            🔗 Map to Wikidata ID
                        </button>
                        <button type="button" class="reject-btn" data-action="reject">
                            ✗ Reject
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    modal.innerHTML = modalContent;
    
    // Add event listeners
    setupApprovalModalEventListeners(modal, entityInfo);
    
    return modal;
}

// Create entity details for modal display
function createEntityDetailsForModal(entity) {
    let detailsHTML = '<div class="entity-details-grid">';
    
    if (entity.type === 'person') {
        if (entity.occupation) detailsHTML += `<div class="detail-item"><label>Occupation:</label><span>${escapeHtml(entity.occupation)}</span></div>`;
        if (entity.currentEmployer) detailsHTML += `<div class="detail-item"><label>Employer:</label><span>${escapeHtml(entity.currentEmployer)}</span></div>`;
        if (entity.currentResidence) detailsHTML += `<div class="detail-item"><label>Residence:</label><span>${escapeHtml(entity.currentResidence)}</span></div>`;
        if (entity.dateOfBirth) detailsHTML += `<div class="detail-item"><label>Birth Date:</label><span>${entity.dateOfBirth}</span></div>`;
    } else if (entity.type === 'place') {
        if (entity.country) detailsHTML += `<div class="detail-item"><label>Country:</label><span>${escapeHtml(entity.country)}</span></div>`;
        if (entity.state) detailsHTML += `<div class="detail-item"><label>State/Region:</label><span>${escapeHtml(entity.state)}</span></div>`;
        if (entity.population) detailsHTML += `<div class="detail-item"><label>Population:</label><span>${entity.population.toLocaleString()}</span></div>`;
    } else if (entity.type === 'organization') {
        if (entity.category) detailsHTML += `<div class="detail-item"><label>Category:</label><span>${escapeHtml(entity.category)}</span></div>`;
        if (entity.industry) detailsHTML += `<div class="detail-item"><label>Industry:</label><span>${escapeHtml(entity.industry)}</span></div>`;
        if (entity.location) detailsHTML += `<div class="detail-item"><label>Location:</label><span>${escapeHtml(entity.location)}</span></div>`;
        if (entity.founded) detailsHTML += `<div class="detail-item"><label>Founded:</label><span>${entity.founded}</span></div>`;
    }
    
    detailsHTML += '</div>';
    return detailsHTML;
}

// Setup event listeners for approval modal
function setupApprovalModalEventListeners(modal, entityInfo) {
    // Close button
    const closeBtn = modal.querySelector('.approval-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeApprovalModal);
    }
    
    // Action buttons
    const approveBtn = modal.querySelector('.approve-btn');
    const rejectBtn = modal.querySelector('.reject-btn');
    const mapBtn = modal.querySelector('.map-btn');
    
    if (approveBtn) {
        approveBtn.addEventListener('click', () => handleApprovalAction('approve', entityInfo));
    }
    
    if (rejectBtn) {
        rejectBtn.addEventListener('click', () => handleApprovalAction('reject', entityInfo));
    }
    
    if (mapBtn) {
        mapBtn.addEventListener('click', () => handleApprovalAction('map', entityInfo));
    }
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeApprovalModal();
        }
    });
    
    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeApprovalModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

// Close approval modal
function closeApprovalModal() {
    const modal = document.querySelector('.approval-modal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
}

// Handle approval actions
async function handleApprovalAction(action, entityInfo) {
    
    try {
        if (action === 'approve' && entityInfo.entity) {
            // Show immediate feedback that approval is in progress
            showEntityProcessing(entityInfo.originalName, 'Saving...');
            
            // Import required functions
            const { saveEntityToFirebase } = await import('./firebaseOperations.js');
            const { getFirebaseCollectionName } = await import('./collectionMapping.js');
            
            // Save to Firebase
            const collectionName = getFirebaseCollectionName(entityInfo.entity.type + 's');
            await saveEntityToFirebase(entityInfo.entity, collectionName);
            
            console.log(`✅ Successfully saved ${entityInfo.entity.name} to Firebase`);
            
            // Update the CSV table to show this entity as approved
            updateEntityInCSVTable(entityInfo.originalName, 'approved');
            
        } else if (action === 'reject') {
            
            // Update the CSV table to show this entity as rejected
            updateEntityInCSVTable(entityInfo.originalName, 'rejected');
            
        } else if (action === 'map') {
            // Handle mapping to Wikidata - prompt for Wikidata ID
            const wikidataId = prompt('Enter Wikidata ID (e.g., Q123456):');
            if (wikidataId && /^Q\d+$/i.test(wikidataId.trim())) {
                // TODO: Implement Wikidata mapping
                alert('Wikidata mapping functionality will be implemented soon!');
            } else if (wikidataId) {
                alert('Please enter a valid Wikidata ID (e.g., Q123456)');
                return; // Don't close modal
            }
        }
        
        // Close the modal
        closeApprovalModal();
        
    } catch (error) {
        console.error('Error handling approval action:', error);
        alert(`Error: ${error.message}`);
    }
}

// Show processing state for entity (immediate feedback)
function showEntityProcessing(originalName, message) {
    const entitySpans = document.querySelectorAll('.new-entity');
    entitySpans.forEach(span => {
        if (span.textContent.trim() === originalName) {
            span.style.opacity = '0.7';
            span.style.pointerEvents = 'none';
            span.title = message;
            
            // Add a subtle pulsing animation
            span.style.animation = 'pulse 1.5s ease-in-out infinite';
        }
    });
}

// Update entity styling in CSV table based on approval status
function updateEntityInCSVTable(originalName, status) {
    const entitySpans = document.querySelectorAll('.new-entity');
    entitySpans.forEach(span => {
        if (span.textContent.trim() === originalName) {
            // Remove any inline styles to let CSS classes take effect
            span.style.removeProperty('background');
            span.style.removeProperty('border-color');
            span.style.removeProperty('color');
            span.style.removeProperty('opacity');
            span.style.removeProperty('pointer-events');
            span.style.removeProperty('animation');
            
            // Update class and title
            span.className = `entity-${status}`;
            span.title = status === 'approved' ? 'Successfully added to knowledge base ✓' : 'Rejected ✗';
            
            // Remove click handler for approved/rejected entities
            span.style.cursor = 'default';
            span.onclick = null;
        }
    });
}

// Handle file upload
export function handleCSVUpload(file, statusDiv) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('No file provided'));
            return;
        }
        
        if (!file.name.toLowerCase().endsWith('.csv')) {
            reject(new Error('Please select a CSV file'));
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            reject(new Error('File size must be less than 10MB'));
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                showStatus('Processing CSV file...', 'success', statusDiv);
                const csvContent = e.target.result;
                const result = parseCSV(csvContent);
                
                if (result.success) {
                    showStatus(`Successfully loaded ${result.totalRows} rows from CSV`, 'success', statusDiv);
                    resolve(result);
                } else {
                    reject(new Error(result.error));
                }
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = function() {
            reject(new Error('Error reading file'));
        };
        
        reader.readAsText(file);
    });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Export CSV data back to file (utility function)
export function exportCSVData(data, filename = 'knowledge_base_export.csv') {
    if (!data || data.length === 0) return;
    
    const columns = EXPECTED_COLUMNS;
    const csvContent = [
        // Header row
        columns.map(col => `"${col}"`).join(','),
        // Data rows
        ...data.map(row => 
            columns.map(col => `"${(row[col] || '').replace(/"/g, '""')}"`).join(',')
        )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
