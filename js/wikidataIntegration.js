// Wikidata integration for entity enrichment
import { escapeHtml } from './dataProcessor.js';

// Wikidata SPARQL endpoint
const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

// Cache for Wikidata results to avoid duplicate requests
const wikidataCache = new Map();

// Extract unique entities from CSV data
export function extractEntitiesFromCSV(csvData) {
    if (!csvData || !csvData.data) return [];
    
    const entities = new Set();
    
    csvData.data.forEach(row => {
        // Extract from Actor column
        if (row.Actor && row.Actor.trim()) {
            entities.add(row.Actor.trim());
        }
        
        // Extract from Target column
        if (row.Target && row.Target.trim()) {
            entities.add(row.Target.trim());
        }
        
        // Extract from Locations column (may contain multiple locations)
        if (row.Locations && row.Locations.trim()) {
            const locations = row.Locations.split(',');
            locations.forEach(location => {
                const cleanLocation = location.trim();
                if (cleanLocation) {
                    entities.add(cleanLocation);
                }
            });
        }
    });
    
    return Array.from(entities).filter(entity => entity.length > 0);
}

// Search Wikidata for an entity
export async function searchWikidataEntity(entityName) {
    // Check cache first
    if (wikidataCache.has(entityName)) {
        return wikidataCache.get(entityName);
    }
    
    try {
        // First, search for the entity to get potential matches
        const searchUrl = `${WIKIDATA_API}?action=wbsearchentities&search=${encodeURIComponent(entityName)}&language=en&format=json&origin=*&limit=3`;
        
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();
        
        if (!searchData.search || searchData.search.length === 0) {
            console.log(`No Wikidata results found for: ${entityName}`);
            wikidataCache.set(entityName, null);
            return null;
        }
        
        // Get detailed information for the best match
        const bestMatch = searchData.search[0];
        const entityId = bestMatch.id;
        
        const detailedInfo = await getWikidataEntityDetails(entityId, entityName);
        
        wikidataCache.set(entityName, detailedInfo);
        return detailedInfo;
        
    } catch (error) {
        console.error(`Error searching Wikidata for ${entityName}:`, error);
        wikidataCache.set(entityName, null);
        return null;
    }
}

// Get detailed information about a Wikidata entity
export async function getWikidataEntityDetails(entityId, originalName) {
    try {
        // SPARQL query to get comprehensive information
        const sparqlQuery = `
            SELECT DISTINCT ?item ?itemLabel ?itemDescription ?instanceOf ?instanceOfLabel 
                   ?countryLabel ?locationLabel ?occupationLabel ?employerLabel 
                   ?birthDate ?founded ?population ?coordinates ?wikidataId
            WHERE {
                VALUES ?item { wd:${entityId} }
                
                OPTIONAL { ?item wdt:P31 ?instanceOf . }
                OPTIONAL { ?item wdt:P17 ?country . }
                OPTIONAL { ?item wdt:P131 ?location . }
                OPTIONAL { ?item wdt:P106 ?occupation . }
                OPTIONAL { ?item wdt:P108 ?employer . }
                OPTIONAL { ?item wdt:P569 ?birthDate . }
                OPTIONAL { ?item wdt:P571 ?founded . }
                OPTIONAL { ?item wdt:P1082 ?population . }
                OPTIONAL { ?item wdt:P625 ?coordinates . }
                
                BIND(STRAFTER(STR(?item), "http://www.wikidata.org/entity/") AS ?wikidataId)
                
                SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
            }
            LIMIT 1
        `;
        
        const sparqlUrl = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(sparqlQuery)}&format=json`;
        
        const response = await fetch(sparqlUrl);
        const data = await response.json();
        
        if (!data.results || !data.results.bindings || data.results.bindings.length === 0) {
            return {
                originalName,
                wikidataId: entityId,
                found: false,
                entityType: 'unknown'
            };
        }
        
        const binding = data.results.bindings[0];
        return processWikidataResult(binding, originalName);
        
    } catch (error) {
        console.error(`Error getting details for ${entityId}:`, error);
        return {
            originalName,
            wikidataId: entityId,
            found: false,
            entityType: 'unknown',
            error: error.message
        };
    }
}

// Process Wikidata SPARQL result into our entity format
function processWikidataResult(binding, originalName) {
    const instanceOfValue = binding.instanceOfLabel?.value;
    const entityType = determineEntityType(instanceOfValue);
    
    console.log('🔍 Processing Wikidata result:');
    console.log('🔍 Original name:', originalName);
    console.log('🔍 Instance of:', instanceOfValue);
    console.log('🔍 Determined entity type:', entityType);
    
    const result = {
        originalName,
        wikidataId: binding.wikidataId?.value || '',
        found: true,
        name: binding.itemLabel?.value || originalName,
        description: binding.itemDescription?.value || '',
        entityType: entityType,
        instanceOf: instanceOfValue || ''
    };
    
    // Add type-specific fields based on entity type
    if (result.entityType === 'person') {
        result.person = {
            id: `wikidata_${result.wikidataId}`,
            name: result.name,
            aliases: [originalName],
            type: 'person',
            occupation: binding.occupationLabel?.value || '',
            currentEmployer: binding.employerLabel?.value || '',
            dateOfBirth: binding.birthDate?.value || '',
            wikidata_id: result.wikidataId,
            description: result.description
        };
    } else if (result.entityType === 'place') {
        result.place = {
            id: `wikidata_${result.wikidataId}`,
            name: result.name,
            aliases: [originalName],
            type: 'place',
            category: binding.instanceOfLabel?.value || 'place',
            country: binding.countryLabel?.value || '',
            state: binding.locationLabel?.value || '',
            population: binding.population?.value ? parseInt(binding.population.value) : null,
            founded: binding.founded?.value ? new Date(binding.founded.value).getFullYear() : null,
            coordinates: parseCoordinates(binding.coordinates?.value),
            wikidata_id: result.wikidataId,
            description: result.description
        };
    } else if (result.entityType === 'organization') {
        result.organization = {
            id: `wikidata_${result.wikidataId}`,
            name: result.name,
            aliases: [originalName],
            type: 'organization',
            category: binding.instanceOfLabel?.value || 'organization',
            founded: binding.founded?.value ? new Date(binding.founded.value).getFullYear() : null,
            location: binding.locationLabel?.value || binding.countryLabel?.value || '',
            wikidata_id: result.wikidataId,
            description: result.description
        };
    }
    
    console.log('🔍 Final result structure:', {
        entityType: result.entityType,
        hasPerson: !!result.person,
        hasPlace: !!result.place,
        hasOrganization: !!result.organization,
        keys: Object.keys(result)
    });
    
    return result;
}

// Determine entity type from Wikidata instance type
function determineEntityType(instanceOf) {
    if (!instanceOf) return 'unknown';
    
    const instanceLower = instanceOf.toLowerCase();
    
    // Person indicators
    if (instanceLower.includes('human') || 
        instanceLower.includes('person') || 
        instanceLower.includes('politician') ||
        instanceLower.includes('diplomat') ||
        instanceLower.includes('minister') ||
        instanceLower.includes('president') ||
        instanceLower.includes('prime minister') ||
        instanceLower.includes('spokesperson')) {
        return 'person';
    }
    
    // Place indicators
    if (instanceLower.includes('city') || 
        instanceLower.includes('country') || 
        instanceLower.includes('state') ||
        instanceLower.includes('capital') ||
        instanceLower.includes('municipality') ||
        instanceLower.includes('emirate') ||
        instanceLower.includes('region') ||
        instanceLower.includes('territory') ||
        instanceLower.includes('place') ||
        instanceLower.includes('location') ||
        instanceLower.includes('building') ||
        instanceLower.includes('university') ||
        instanceLower.includes('office')) {
        return 'place';
    }
    
    // Organization indicators
    if (instanceLower.includes('organization') || 
        instanceLower.includes('company') || 
        instanceLower.includes('government') ||
        instanceLower.includes('ministry') ||
        instanceLower.includes('council') ||
        instanceLower.includes('agency') ||
        instanceLower.includes('institution') ||
        instanceLower.includes('association') ||
        instanceLower.includes('league') ||
        instanceLower.includes('cooperation') ||
        instanceLower.includes('summit')) {
        return 'organization';
    }
    
    return 'unknown';
}

// Parse coordinates from Wikidata format
function parseCoordinates(coordinateString) {
    if (!coordinateString) return null;
    
    try {
        // Wikidata coordinates come in format "Point(longitude latitude)"
        const match = coordinateString.match(/Point\(([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\)/);
        if (match) {
            return {
                lng: parseFloat(match[1]),
                lat: parseFloat(match[2])
            };
        }
    } catch (error) {
        console.warn('Error parsing coordinates:', coordinateString, error);
    }
    
    return null;
}

// Process all entities from CSV and enrich with Wikidata
export async function enrichCSVWithWikidata(csvData) {
    console.log('🔍 Starting Wikidata enrichment process...');
    
    const entities = extractEntitiesFromCSV(csvData);
    console.log(`📊 Extracted ${entities.length} unique entities from CSV:`, entities);
    
    const enrichedEntities = {
        people: [],
        places: [],
        organizations: [],
        unknown: [],
        notFound: []
    };
    
    // Process entities in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < entities.length; i += batchSize) {
        const batch = entities.slice(i, i + batchSize);
        console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(entities.length/batchSize)}: ${batch.join(', ')}`);
        
        const batchPromises = batch.map(entity => searchWikidataEntity(entity));
        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach((result, index) => {
            const entityName = batch[index];
            
            if (!result || !result.found) {
                enrichedEntities.notFound.push({
                    originalName: entityName,
                    reason: result?.error || 'Not found in Wikidata'
                });
                console.log(`❌ Not found: ${entityName}`);
                return;
            }
            
            console.log(`✅ Found: ${entityName} → ${result.name} (${result.entityType})`);
            
            if (result.entityType === 'person' && result.person) {
                enrichedEntities.people.push(result.person);
            } else if (result.entityType === 'place' && result.place) {
                enrichedEntities.places.push(result.place);
            } else if (result.entityType === 'organization' && result.organization) {
                enrichedEntities.organizations.push(result.organization);
            } else {
                enrichedEntities.unknown.push({
                    originalName: entityName,
                    wikidataId: result.wikidataId,
                    name: result.name,
                    instanceOf: result.instanceOf,
                    description: result.description
                });
            }
        });
        
        // Small delay between batches to be respectful to the API
        if (i + batchSize < entities.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    // Log summary
    console.log('\n📋 WIKIDATA ENRICHMENT SUMMARY:');
    console.log(`👥 People found: ${enrichedEntities.people.length}`);
    console.log(`📍 Places found: ${enrichedEntities.places.length}`);
    console.log(`🏢 Organizations found: ${enrichedEntities.organizations.length}`);
    console.log(`❓ Unknown entities: ${enrichedEntities.unknown.length}`);
    console.log(`❌ Not found: ${enrichedEntities.notFound.length}`);
    
    // Log detailed results for Firebase-ready entities
    if (enrichedEntities.people.length > 0) {
        console.log('\n👥 PEOPLE (Firebase-ready format):');
        enrichedEntities.people.forEach(person => {
            console.log(`  • ${person.name}:`, person);
        });
    }
    
    if (enrichedEntities.places.length > 0) {
        console.log('\n📍 PLACES (Firebase-ready format):');
        enrichedEntities.places.forEach(place => {
            console.log(`  • ${place.name}:`, place);
        });
    }
    
    if (enrichedEntities.organizations.length > 0) {
        console.log('\n🏢 ORGANIZATIONS (Firebase-ready format):');
        enrichedEntities.organizations.forEach(org => {
            console.log(`  • ${org.name}:`, org);
        });
    }
    
    return enrichedEntities;
}
