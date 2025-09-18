// UI management and display functions
import { escapeHtml } from './dataProcessor.js';

// Show status message
export function showStatus(message, type, statusDiv) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

// Create data item element for display
export function createDataItem(entity, entityType) {
    const item = document.createElement('div');
    item.className = 'data-item';
    
    const timestamp = entity.created ? new Date(entity.created).toLocaleString() : 'Unknown';
    const entityLabel = entityType === 'people' ? 'Person' : entityType === 'places' ? 'Place' : 'Organization';
    
    let content = `<h4>${escapeHtml(entity.name || 'Unnamed')} <span style="font-size: 12px; color: var(--gray-500); font-weight: normal; text-transform: uppercase; letter-spacing: 0.05em;">${entityLabel}</span></h4>`;
    
    // Display key fields based on entity type
    if (entityType === 'people') {
        if (entity.occupation) content += `<p><strong>Occupation:</strong> ${escapeHtml(entity.occupation)}</p>`;
        if (entity.currentEmployer) content += `<p><strong>Current Employer:</strong> ${escapeHtml(entity.currentEmployer)}</p>`;
        if (entity.currentResidence) content += `<p><strong>Location:</strong> ${escapeHtml(entity.currentResidence)}</p>`;
    } else if (entityType === 'places') {
        if (entity.category) content += `<p><strong>Category:</strong> ${escapeHtml(entity.category)}</p>`;
        if (entity.country) content += `<p><strong>Country:</strong> ${escapeHtml(entity.country)}</p>`;
        if (entity.population) content += `<p><strong>Population:</strong> ${entity.population.toLocaleString()}</p>`;
    } else if (entityType === 'organizations') {
        if (entity.category) content += `<p><strong>Category:</strong> ${escapeHtml(entity.category)}</p>`;
        if (entity.industry) content += `<p><strong>Industry:</strong> ${escapeHtml(entity.industry)}</p>`;
        if (entity.location) content += `<p><strong>Location:</strong> ${escapeHtml(entity.location)}</p>`;
    }
    
    if (entity.description) {
        content += `<p><strong>Description:</strong> ${escapeHtml(entity.description)}</p>`;
    }
    
    // Show aliases if they exist
    if (entity.aliases && entity.aliases.length > 0) {
        content += `<p><strong>Aliases:</strong> ${entity.aliases.map(alias => escapeHtml(alias)).join(', ')}</p>`;
    }
    
    content += `<p class="timestamp">ID: ${escapeHtml(entity.id)} | Created: ${timestamp}</p>`;
    
    item.innerHTML = content;
    return item;
}

// Set loading state for buttons
export function setButtonLoading(button, isLoading, originalText, loadingText) {
    if (isLoading) {
        button.disabled = true;
        button.textContent = loadingText;
    } else {
        button.disabled = false;
        button.textContent = originalText;
    }
}

// Clear data display (legacy function - kept for compatibility)
export function clearDataDisplay() {
    // This function is kept for compatibility but no longer needed
    // since we removed the separate data display section
}

// Show data display (legacy function - kept for compatibility)
export function showDataDisplay() {
    // This function is kept for compatibility but no longer needed
    // since we removed the separate data display section
}
