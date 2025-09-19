// Dynamic form building functionality
import { entityFields, formatFieldName } from './entityFields.js';

// Generate dynamic fields based on entity type
export function generateDynamicFields(entityType, dynamicFields) {
    dynamicFields.innerHTML = '';
    
    if (!entityType || !entityFields[entityType]) {
        return;
    }
    
    const fields = entityFields[entityType];
    
    // Create a simple form container
    const formContainer = document.createElement('div');
    formContainer.className = 'form-container';
    
    // Add special wikidata section if wikidata_id field exists
    const wikidataField = fields.find(f => f.name === 'wikidata_id');
    if (wikidataField) {
        const wikidataSection = document.createElement('div');
        wikidataSection.className = 'wikidata-section';
        
        const fieldDiv = document.createElement('div');
        fieldDiv.className = getCompactFieldClassName(wikidataField);
        
        const label = document.createElement('label');
        label.className = 'form-label';
        label.textContent = formatFieldName(wikidataField.name);
        label.setAttribute('for', wikidataField.name);
        
        const input = createCompactFieldInput(wikidataField);
        
        fieldDiv.appendChild(label);
        fieldDiv.appendChild(input);
        
        const helpText = document.createElement('div');
        helpText.className = 'help-text';
        helpText.textContent = 'Enter Wikidata ID (e.g., Q62) to auto-fill fields';
        fieldDiv.appendChild(helpText);
        
        // Add autofill functionality
        input.addEventListener('blur', handleWikidataAutofill);
        
        wikidataSection.appendChild(fieldDiv);
        dynamicFields.appendChild(wikidataSection);
    }
    
    // Add all other fields to the form container
    fields.forEach(field => {
        if (field.name === 'wikidata_id') return; // Skip, already added above
        
        const fieldDiv = document.createElement('div');
        fieldDiv.className = getCompactFieldClassName(field);
        
        // Add special class for sports fields
        if (field.group === 'sports') {
            fieldDiv.classList.add('sports-field', 'hidden');
        }
        
        const label = document.createElement('label');
        label.className = 'form-label';
        label.textContent = formatFieldName(field.name);
        
        // Set the 'for' attribute based on field type
        if (field.type !== 'array') {
            label.setAttribute('for', field.name);
        }
        
        if (field.required) {
            label.classList.add('required');
        }
        
        const input = createCompactFieldInput(field);
        
        fieldDiv.appendChild(label);
        fieldDiv.appendChild(input);
        
        // Add event listener for category changes to toggle sports fields
        if (field.name === 'category') {
            input.addEventListener('change', function() {
                toggleSportsFields(this.value);
            });
        }
        
        formContainer.appendChild(fieldDiv);
    });
    
    dynamicFields.appendChild(formContainer);
}





// Get compact CSS class for modal fields
function getCompactFieldClassName(field) {
    let className = 'form-group';
    
    // Full width fields (take entire row)
    if (field.type === 'textarea' || field.name === 'description' || field.type === 'array') {
        className += ' full-width';
    }
    
    // Very short fields can be inline
    if (field.type === 'number' && (field.name.includes('year') || field.name.includes('age'))) {
        className += ' compact inline';
    }
    
    // Date fields are compact
    if (field.type === 'date') {
        className += ' compact';
    }
    
    return className;
}

// Create appropriate input for field type
function createFieldInput(field) {
    if (field.type === 'array') {
        return createArrayField(field);
    } else if (field.type === 'select') {
        return createSelectField(field);
    } else if (field.type === 'textarea') {
        return createTextareaField(field);
    } else if (field.name === 'coordinates_lat' || field.name === 'coordinates_lng') {
        return createCoordinateField(field);
    } else {
        return createInputField(field);
    }
}

// Create compact input for modal forms
function createCompactFieldInput(field) {
    let input;
    
    if (field.type === 'array') {
        input = createArrayField(field);
    } else if (field.type === 'select') {
        input = createSelectField(field);
        input.className = 'form-select';
    } else if (field.type === 'textarea') {
        input = createTextareaField(field);
        input.className = field.name === 'description' ? 'form-textarea' : 'form-textarea compact';
    } else {
        input = createInputField(field);
        input.className = 'form-input';
    }
    
    return input;
}

function createInputField(field) {
    const input = document.createElement('input');
    input.type = field.type;
    input.id = field.name;
    input.name = field.name;
    input.placeholder = field.placeholder || '';
    input.required = field.required || false;
    if (field.step) input.step = field.step;
    return input;
}

function createSelectField(field) {
    const select = document.createElement('select');
    select.id = field.name;
    select.name = field.name;
    select.required = field.required || false;
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select...';
    select.appendChild(defaultOption);
    
    field.options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option.charAt(0).toUpperCase() + option.slice(1);
        select.appendChild(optionElement);
    });
    
    return select;
}

function createTextareaField(field) {
    const textarea = document.createElement('textarea');
    textarea.id = field.name;
    textarea.name = field.name;
    textarea.placeholder = field.placeholder || '';
    textarea.required = field.required || false;
    textarea.rows = 4;
    return textarea;
}

function createArrayField(field) {
    const container = document.createElement('div');
    container.className = 'array-field';
    container.id = field.name + '_container';
    
    const arrayDiv = document.createElement('div');
    arrayDiv.id = field.name + '_array';
    
    // Add initial input
    addArrayInput(arrayDiv, field.name, field.placeholder);
    
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'add-btn';
    addBtn.textContent = '+ Add Another';
    addBtn.onclick = () => addArrayInput(arrayDiv, field.name, field.placeholder);
    
    container.appendChild(arrayDiv);
    container.appendChild(addBtn);
    
    return container;
}

function createCoordinateField(field) {
    const input = document.createElement('input');
    input.type = 'number';
    input.id = field.name;
    input.name = field.name;
    input.placeholder = field.placeholder || '';
    input.step = 'any';
    
    if (field.name === 'coordinates_lat') {
        input.min = '-90';
        input.max = '90';
    } else if (field.name === 'coordinates_lng') {
        input.min = '-180';
        input.max = '180';
    }
    
    return input;
}

function addArrayInput(container, fieldName, placeholder) {
    const inputDiv = document.createElement('div');
    inputDiv.className = 'array-input';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.name = fieldName;
    input.id = `${fieldName}_${container.children.length}`;
    input.placeholder = placeholder || '';
    
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '✕';
    removeBtn.onclick = () => {
        if (container.children.length > 1) {
            container.removeChild(inputDiv);
        }
    };
    
    inputDiv.appendChild(input);
    inputDiv.appendChild(removeBtn);
    container.appendChild(inputDiv);
}

// Handle Wikidata autofill when user enters a Wikidata ID
async function handleWikidataAutofill(event) {
    const wikidataId = event.target.value.trim();
    
    if (!wikidataId || !wikidataId.match(/^Q\d+$/)) {
        return; // Invalid Wikidata ID format
    }
    
    try {
        // Show loading state
        event.target.style.backgroundColor = '#f0f8ff';
        event.target.disabled = true;
        
        // Import the Wikidata integration function
        const { getWikidataEntityDetails } = await import('./wikidataIntegration.js');
        
        
        // Fetch entity details from Wikidata
        const details = await getWikidataEntityDetails(wikidataId, wikidataId);
        
        if (details && details.found) {
            const entityData = details; // Use the returned entity object
            
            
            // Auto-fill form fields based on the data
            autofillFormFields(entityData, wikidataId);
            
            // Show success feedback
            showAutofillFeedback(event.target, 'success', 'Auto-filled from Wikidata!');
        } else {
            showAutofillFeedback(event.target, 'warning', 'No data found for this Wikidata ID');
        }
        
    } catch (error) {
        console.error('Error fetching Wikidata details:', error);
        showAutofillFeedback(event.target, 'error', 'Failed to fetch Wikidata data');
    } finally {
        // Reset input state
        event.target.style.backgroundColor = '';
        event.target.disabled = false;
    }
}

// Auto-fill form fields with Wikidata entity data
function autofillFormFields(entityData, wikidataId) {
    
    // Get the specific entity data based on entity type
    let specificEntityData = null;
    if (entityData.person) {
        specificEntityData = entityData.person;
    } else if (entityData.place) {
        specificEntityData = entityData.place;
    } else if (entityData.organization) {
        specificEntityData = entityData.organization;
    }
    
    if (!specificEntityData) {
        console.warn('❌ No specific entity data found for autofill');
        console.log('❌ Available keys in entityData:', Object.keys(entityData));
        console.log('❌ Falling back to basic entity data');
        
        // Fallback: use the basic entity data directly
        specificEntityData = {
            name: entityData.name,
            description: entityData.description,
            wikidata_id: entityData.wikidataId
        };
        
    }
    
    // Map entity fields to form fields
    const fieldMappings = {
        'name': 'name',
        'description': 'description',
        'occupation': 'occupation',
        'dateOfBirth': 'dateOfBirth',
        'gender': 'gender',
        'category': 'category',
        'country': 'country',
        'population': 'population',
        'industry': 'industry',
        'founded': 'founded',
        'location': 'location',
        'currentEmployer': 'currentEmployer',
        'state': 'state',
        'sport': 'sport',
        'league': 'league',
        'stadium': 'stadium',
        'coach': 'coach',
        'conference': 'conference',
        'division': 'division'
    };
    
    // Fill in the fields
    Object.keys(fieldMappings).forEach(formField => {
        const input = document.getElementById(formField);
        if (!input || input.value.trim()) return; // Skip if field doesn't exist or already has value
        
        const entityField = fieldMappings[formField];
        if (specificEntityData[entityField]) {
            let value = specificEntityData[entityField];
            
            // Handle arrays by taking first value
            if (Array.isArray(value)) {
                value = value[0];
            }
            
            // Set the value
            if (input.type === 'select-one') {
                // For select fields, try to find matching option
                const option = Array.from(input.options).find(opt => 
                    opt.value.toLowerCase() === value.toLowerCase()
                );
                if (option) {
                    input.value = option.value;
                    // If this is the category field and it's a sports team, show sports fields
                    if (formField === 'category' && option.value === 'sports team') {
                        toggleSportsFields('sports team');
                    }
                }
            } else {
                input.value = value;
            }
            
            // Highlight the filled field
            input.style.backgroundColor = '#f0fff0';
            setTimeout(() => {
                input.style.backgroundColor = '';
            }, 2000);
        }
    });
    
    // Handle coordinates specially for places
    if (specificEntityData.coordinates) {
        const latInput = document.getElementById('coordinates_lat');
        const lngInput = document.getElementById('coordinates_lng');
        
        if (latInput && !latInput.value.trim() && specificEntityData.coordinates.lat) {
            latInput.value = specificEntityData.coordinates.lat;
            latInput.style.backgroundColor = '#f0fff0';
            setTimeout(() => latInput.style.backgroundColor = '', 2000);
        }
        
        if (lngInput && !lngInput.value.trim() && specificEntityData.coordinates.lng) {
            lngInput.value = specificEntityData.coordinates.lng;
            lngInput.style.backgroundColor = '#f0fff0';
            setTimeout(() => lngInput.style.backgroundColor = '', 2000);
        }
    }
    
    // Handle aliases array
    if (specificEntityData.aliases && Array.isArray(specificEntityData.aliases)) {
        const aliasContainer = document.getElementById('aliases_array');
        if (aliasContainer && aliasContainer.children.length === 1) {
            // Fill first alias input if empty
            const firstInput = aliasContainer.querySelector('input');
            if (firstInput && !firstInput.value.trim()) {
                firstInput.value = specificEntityData.aliases[0];
                firstInput.style.backgroundColor = '#f0fff0';
                setTimeout(() => firstInput.style.backgroundColor = '', 2000);
            }
        }
    }
}

// Show feedback message for autofill operation
function showAutofillFeedback(inputElement, type, message) {
    // Remove any existing feedback
    const existingFeedback = inputElement.parentNode.querySelector('.autofill-feedback');
    if (existingFeedback) {
        existingFeedback.remove();
    }
    
    // Create feedback element
    const feedback = document.createElement('div');
    feedback.className = `autofill-feedback ${type}`;
    feedback.textContent = message;
    
    // Insert after the input
    inputElement.parentNode.insertBefore(feedback, inputElement.nextSibling);
    
    // Remove feedback after 3 seconds
    setTimeout(() => {
        if (feedback.parentNode) {
            feedback.parentNode.removeChild(feedback);
        }
    }, 3000);
}

// Toggle sports fields visibility based on category selection
function toggleSportsFields(category) {
    const sportsFields = document.querySelectorAll('.sports-field');
    if (sportsFields.length > 0) {
        sportsFields.forEach(field => {
            if (category === 'sports team') {
                field.classList.remove('hidden');
            } else {
                field.classList.add('hidden');
            }
        });
        console.log(category === 'sports team' ? '🏈 Showing sports fields' : '🏢 Hiding sports fields');
    }
}
