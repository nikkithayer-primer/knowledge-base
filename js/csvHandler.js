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
        console.log('📋 CSV Header parsed:', header);
        validateHeader(header);
        console.log('✅ CSV Header validated successfully');
        
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
                
                console.log(`📊 Row ${i + 1} data:`, rowData);
                
                // Validate and process the row
                const processedRow = processRow(rowData, i + 1);
                if (processedRow) {
                    data.push(processedRow);
                    console.log(`✅ Row ${i + 1} processed successfully`);
                } else {
                    console.warn(`❌ Row ${i + 1} was rejected during processing`);
                    skippedRows++;
                }
            }
        }
        
        console.log(`📊 CSV Processing Summary:
            - Total lines: ${lines.length}
            - Rows processed: ${totalRowsProcessed}
            - Valid rows: ${data.length}
            - Skipped rows: ${skippedRows}
        `);
        
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
    
    // Count duplicates for info display
    const duplicateCount = duplicates.size;
    
    let tableHTML = `
        <div class="table-info">
            <p><strong>${data.length}</strong> rows loaded</p>
            ${duplicateCount > 0 ? `<p class="duplicate-info">🔍 <strong>${duplicateCount}</strong> entities already exist in knowledge base</p>` : ''}
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
            
            // Check if this cell contains a duplicate entity and wrap in span
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
                        }
                        return escapeHtml(trimmedLocation);
                    });
                    processedValue = processedLocations.join(', ');
                } else if (value && duplicates.has(value.trim().toLowerCase())) {
                    // Handle single entity (Actor or Target)
                    const dupInfo = duplicates.get(value.trim().toLowerCase());
                    const dupInfoJson = escapeHtml(JSON.stringify(dupInfo));
                    processedValue = `<span class="duplicate-entity" data-duplicate-info="${dupInfoJson}" title="Click to view knowledge base entry">${escapeHtml(value)}</span>`;
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

// Initialize duplicate entity click handlers after table is rendered
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
