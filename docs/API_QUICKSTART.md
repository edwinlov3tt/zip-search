# 🚀 Geocoding API Quick Start Guide

## Base URL
```
https://ignite.edwinlovett.com/geocoder/geocode-api.php
```

## 🎯 Quick Examples

### Single Address (Simple)
```bash
curl "https://ignite.edwinlovett.com/geocoder/geocode-api.php/api/geocode?address=123+Main+St,+NYC"
```

### Unlimited Batch (No Limits!)
```bash
# Send 10, 100, 1000, or 10000 addresses - no problem!
curl -X POST "https://ignite.edwinlovett.com/geocoder/geocode-api.php/api/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "addresses": [
      "123 Main St, NYC",
      "456 Oak Ave, LA",
      ... (add as many as you need)
    ]
  }'
```

## 📊 Three Ways to Process Large Batches

### Method 1: Fire & Forget with Polling
```javascript
// Step 1: Submit unlimited addresses
const response = await fetch(baseUrl + '/api/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        addresses: addresses  // Can be 10,000+ addresses!
    })
});

const { job_id, status_url } = await response.json();

// Step 2: Poll for status
const checkStatus = async () => {
    const status = await fetch(baseUrl + status_url).then(r => r.json());
    console.log(`Progress: ${status.percentage}% (${status.processed}/${status.total_addresses})`);

    if (status.completed) {
        // Get results
        const results = await fetch(baseUrl + `/api/job/results?job_id=${job_id}`);
        return results.json();
    } else {
        // Check again in 2 seconds
        setTimeout(checkStatus, 2000);
    }
};

checkStatus();
```

### Method 2: Real-time Streaming (Server-Sent Events)
```javascript
// Submit job and get stream URL
const response = await fetch(baseUrl + '/api/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addresses })
});

const { job_id, stream_url } = await response.json();

// Connect to real-time stream
const eventSource = new EventSource(baseUrl + stream_url);

eventSource.addEventListener('row', (e) => {
    const result = JSON.parse(e.data);
    console.log(`Geocoded: ${result.address} → ${result.lat}, ${result.lng}`);
});

eventSource.addEventListener('progress', (e) => {
    const progress = JSON.parse(e.data);
    console.log(`Progress: ${progress.percentage}%`);
});

eventSource.addEventListener('done', (e) => {
    console.log('All addresses geocoded!');
    eventSource.close();
});
```

### Method 3: Download Results as CSV
```bash
# After job completes, download CSV
curl "https://ignite.edwinlovett.com/geocoder/geocode-api.php/api/job/results?job_id=YOUR_JOB_ID&format=csv" -o results.csv
```

## 🔥 Complete Workflow Example

```python
import requests
import time
import json

# Your addresses (can be thousands!)
addresses = [
    "123 Main St, New York, NY",
    "456 Oak Ave, Los Angeles, CA",
    # ... add 10,000 more addresses
]

# Step 1: Submit job
response = requests.post(
    "https://ignite.edwinlovett.com/geocoder/geocode-api.php/api/batch",
    json={"addresses": addresses}
)

job_info = response.json()
job_id = job_info['job_id']
print(f"Job created: {job_id}")
print(f"Processing {job_info['total_addresses']} addresses...")

# Step 2: Poll for completion
while True:
    status = requests.get(
        f"https://ignite.edwinlovett.com/geocoder/geocode-api.php/api/job/status?job_id={job_id}"
    ).json()

    print(f"Progress: {status['percentage']}% ({status['processed']}/{status['total_addresses']})")

    if status['completed']:
        break

    time.sleep(2)  # Poll every 2 seconds

# Step 3: Get results
results = requests.get(
    f"https://ignite.edwinlovett.com/geocoder/geocode-api.php/api/job/results?job_id={job_id}"
).json()

print(f"Geocoding complete! Got {len(results['results'])} results")

# Process results
for result in results['results']:
    print(f"{result['address']} → {result['lat']}, {result['lng']}")
```

## 📋 API Endpoints

### 1. `/api/geocode` - Single Address
- **Method**: GET or POST
- **Params**: `address` (string)
- **Returns**: Immediate result with lat/lng

### 2. `/api/batch` - Unlimited Batch
- **Method**: POST
- **Body**: `{ "addresses": [...] }`
- **Returns**: Job ID and URLs for polling/streaming
- **No limit on number of addresses!**

### 3. `/api/job/status` - Check Progress
- **Method**: GET
- **Params**: `job_id`
- **Returns**: Current progress and status

### 4. `/api/job/stream` - Real-time Updates
- **Method**: GET (SSE)
- **Params**: `job_id`
- **Returns**: Server-Sent Events stream

### 5. `/api/job/results` - Get Results
- **Method**: GET
- **Params**: `job_id`, `format` (json|csv)
- **Returns**: Complete geocoding results

## 🎯 Key Features

- **No Address Limits**: Send 10 or 10,000 addresses
- **Automatic Deduplication**: Same addresses only geocoded once
- **Smart Provider Routing**: Most accurate providers used first
- **Rate Limit Management**: Automatic handling across all providers
- **7-Day Caching**: Previously geocoded addresses returned instantly
- **Real-time Updates**: Watch progress via SSE or polling
- **CSV Export**: Download results directly as CSV

## 📈 Performance

- **Capacity**: ~156,000 addresses/day across all providers
- **Speed**: 10-50 addresses/second depending on providers
- **Accuracy Priority**:
  1. Geocod.io (US/Canada)
  2. MapTiler (Global)
  3. LocationIQ (Global)
  4. Additional fallbacks

## 🔧 Integration Examples

### JavaScript/Node.js
```javascript
const geocodeAddresses = async (addresses) => {
    const baseUrl = 'https://ignite.edwinlovett.com/geocoder/geocode-api.php';

    // Submit job
    const job = await fetch(baseUrl + '/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses })
    }).then(r => r.json());

    // Poll until complete
    while (true) {
        const status = await fetch(baseUrl + `/api/job/status?job_id=${job.job_id}`)
            .then(r => r.json());

        if (status.completed) {
            // Return results
            return fetch(baseUrl + `/api/job/results?job_id=${job.job_id}`)
                .then(r => r.json());
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
    }
};

// Use it
const results = await geocodeAddresses([
    '123 Main St',
    '456 Oak Ave',
    // ... thousands more
]);
```

### PHP
```php
$addresses = ['123 Main St', '456 Oak Ave']; // Can be thousands

// Submit job
$ch = curl_init('https://ignite.edwinlovett.com/geocoder/geocode-api.php/api/batch');
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['addresses' => $addresses]));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$job = json_decode(curl_exec($ch), true);
curl_close($ch);

// Poll for results
while (true) {
    $status = json_decode(
        file_get_contents("https://ignite.edwinlovett.com/geocoder/geocode-api.php/api/job/status?job_id={$job['job_id']}"),
        true
    );

    if ($status['completed']) {
        $results = json_decode(
            file_get_contents("https://ignite.edwinlovett.com/geocoder/geocode-api.php/api/job/results?job_id={$job['job_id']}"),
            true
        );
        break;
    }

    sleep(2);
}
```

## 💡 Pro Tips

1. **Batch Everything**: Even for 10 addresses, batch processing is more efficient
2. **Use Streaming for UI**: SSE provides real-time updates for progress bars
3. **Cache Results**: Store geocoded results locally to avoid re-geocoding
4. **Handle Failures**: Some addresses may not geocode - check `success` field
5. **Dedupe First**: API automatically deduplicates, but doing it client-side saves bandwidth

## 🚨 Error Handling

```javascript
try {
    const response = await fetch(url);

    if (!response.ok) {
        if (response.status === 429) {
            console.error('Rate limit exceeded - try again later');
        } else if (response.status === 404) {
            console.error('Address could not be geocoded');
        } else {
            console.error(`Error: ${response.status}`);
        }
    }

    const data = await response.json();
    // Process data
} catch (error) {
    console.error('Network error:', error);
}
```

## 📞 Support

- **Max addresses per job**: Unlimited (tested with 10,000+)
- **Rate limits**: Automatically managed
- **Caching**: 7 days
- **Formats**: JSON, CSV
- **CORS**: Enabled for all origins

Ready to geocode at scale! 🚀

 Geocoding Feature Implementation Plan

 Overview

 Add a new "Geocode" search mode alongside existing Upload Search that allows users to
  upload CSVs with addresses/business names and geocode them to lat/lng coordinates
 using the batch geocoding API.

 Phase 1: API Service Integration

 File: src/services/geocodingService.js (new)
 - Create batch geocoding functions using API from docs/API_QUICKSTART.md
 - submitBatchGeocodeJob(addresses) - Submit addresses, return job_id
 - pollJobStatus(job_id) - Poll for completion status and progress
 - getJobResults(job_id) - Retrieve final geocoded results
 - Handle errors, rate limits, and network issues

 Phase 2: Search Mode Toggle

 Files:
 - src/components/Header/SearchModeToggle.jsx - Add "Geocode" mode button
 - src/contexts/SearchContext.jsx - Add geocoding mode state management
 - src/components/Search/GeocodeSearch.jsx (new) - Similar to UploadSearch component

 Changes:
 - Extend search mode to support: 'radius', 'hierarchy', 'upload', 'geocode'
 - Add mode switching logic to show GeocodeSearch when mode is 'geocode'

 Phase 3: CSV Upload & Column Mapping

 Files:
 - src/components/Modals/HeaderMappingModal.jsx - Extend column type options
 - src/utils/csvHelpers.js - Update auto-detection logic

 New Column Types:
 - Business Name
 - Full Address (single field)
 - Street Address (component)
 - City, State, Zip, County (components)

 Mapping Logic:
 - Support EITHER "Full Address" mapping OR component mapping (Street + City + State +
  Zip)
 - Auto-detect: Check for "address", "business", "name", "street" in headers
 - Combine components into full address if mapped separately: ${street}, ${city}, 
 ${state} ${zip}
 - Validate: Require at least Business OR Address column

 Phase 4: Artificial Progress Indicator

 File: src/components/Search/GeocodeSearch.jsx

 Implementation:
 - Show progress bar when batch job is submitted
 - Calculate increment rate: progressRate = 95 / (addressCount * 
 estimatedTimePerAddress)
 - Update progress every 100ms using setInterval
 - Stop at 95% and wait for actual results
 - Jump to 100% when results received

 Phase 5: Results Storage & Display

 Files:
 - src/contexts/ResultsContext.jsx - Add geocodeResults array and management functions
 - src/components/Results/GeocodeResultsTable.jsx (new)
 - src/components/Results/DrawerTabs.jsx - Add "Geocode Results" tab

 GeocodeResults Data Structure:
 {
   id: string,
   businessName: string,
   fullAddress: string,
   street: string,
   city: string,
   state: string,
   zip: string,
   county: string,
   lat: number,
   lng: number,
   accuracy: number,
   provider: string,
   success: boolean
 }

 Table Columns: Business Name | Full Address | Street | City | State | Zip | County |
 Lat | Lng | Accuracy | Remove

 Phase 6: Map Markers

 File: src/components/Map/MapMarkers.jsx

 New Marker Type: Geocoded Address Markers
 - Icon: Blue pin (distinct from red address markers)
 - Popup: ${businessName}\n${fullAddress}\nLat: ${lat}, Lng: ${lng}\nAccuracy: 
 ${accuracy}
 - Click: Switch to 'geocode-results' tab and select the address
 - Filter out removed items

 Phase 7: Not Found & Excluded Handling

 Files:
 - src/contexts/ResultsContext.jsx - Add notFoundAddresses array
 - src/components/Results/ExcludedItems.jsx - Add subtabs

 Implementation:
 - Store failed geocodes in notFoundAddresses array
 - Update ExcludedItems component with two subtabs:
   - "Excluded (5)" - User-removed items (existing functionality)
   - "Not Found (3)" - Failed geocoding attempts
 - Both subtabs show restore button
 - Both support copy/export functionality

 Phase 8: Export & Actions

 Files:
 - src/utils/exportHelpers.js - Add geocode export functions
 - src/components/Results/GeocodeResultsTable.jsx - Add export buttons

 Features:
 - Export to CSV: Include all columns (business, address components, lat, lng,
 accuracy)
 - Copy to clipboard: Formatted text with all data
 - Remove individual geocoded addresses (moves to Excluded)
 - Restore from Not Found (re-submit to geocoding API)

 Phase 9: Integration & Testing

 - Wire up GeocodeSearch in SearchControls component
 - Update drawer to show geocode results tab when geocodeResults.length > 0
 - Test with various CSV formats (full address vs components)
 - Test progress indicator with different batch sizes
 - Verify markers render correctly on map
 - Test exclude/restore flow

 Files to Create

 1. src/services/geocodingService.js
 2. src/components/Search/GeocodeSearch.jsx
 3. src/components/Results/GeocodeResultsTable.jsx

 Files to Modify

 1. src/components/Header/SearchModeToggle.jsx
 2. src/contexts/SearchContext.jsx
 3. src/contexts/ResultsContext.jsx
 4. src/components/Modals/HeaderMappingModal.jsx
 5. src/utils/csvHelpers.js
 6. src/components/Results/DrawerTabs.jsx
 7. src/components/Results/DrawerContent.jsx
 8. src/components/Results/ExcludedItems.jsx
 9. src/components/Map/MapMarkers.jsx
 10. src/utils/exportHelpers.js
 11. src/components/Search/SearchControls.jsx

 Estimated Complexity

 - High: API integration with polling, Progress indicator timing
 - Medium: Column mapping extension, Results table, Map markers
 - Low: Mode toggle, Export functions, UI updates