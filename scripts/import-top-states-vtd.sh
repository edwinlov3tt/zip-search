#!/bin/bash
###############################################################################
# Import Top States VTD Data (Free Tier Compatible)
# Downloads, converts, and imports VTD boundaries for top 3 states
#
# States: Texas (already done), Florida, New York
# Estimated VTDs: ~26,000
# Estimated database size: ~430MB (fits in free tier)
# Estimated time: 20 minutes
###############################################################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}==============================================================================${NC}"
echo -e "${BLUE}VTD Top States Import Script (Free Tier Compatible)${NC}"
echo -e "${BLUE}==============================================================================${NC}"
echo ""

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo -e "${RED}ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable not set${NC}"
  exit 1
fi

mkdir -p temp-vtd-data

# Top states by population (excluding California - no VTD data)
STATES=(
  "12:Florida"
  "36:NewYork"
)

echo -e "${GREEN}✓ Texas already imported (9,007 VTDs)${NC}"
echo -e "${BLUE}Importing 2 additional states...${NC}"
echo ""

TOTAL_VTDS=9007  # Texas
PROCESSED=1  # Texas
FAILED=0
START_TIME=$(date +%s)

for state in "${STATES[@]}"; do
  FIPS="${state%%:*}"
  NAME="${state##*:}"

  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}Processing: $NAME (FIPS: $FIPS)${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  ZIP_FILE="temp-vtd-data/${NAME}_vtd.zip"
  SHP_FILE="temp-vtd-data/cb_2020_${FIPS}_vtd_500k.shp"
  GEOJSON_FILE="temp-vtd-data/${NAME}-vtd.geojson"

  # Download
  echo -e "${BLUE}[1/4] Downloading...${NC}"
  if curl -f -o "$ZIP_FILE" "https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_${FIPS}_vtd_500k.zip" 2>/dev/null; then
    echo -e "${GREEN}✓ Downloaded${NC}"
  else
    echo -e "${RED}✗ Download failed${NC}"
    FAILED=$((FAILED + 1))
    continue
  fi

  # Unzip
  echo -e "${BLUE}[2/4] Extracting...${NC}"
  if unzip -o -q "$ZIP_FILE" -d temp-vtd-data/ 2>/dev/null; then
    echo -e "${GREEN}✓ Extracted${NC}"
  else
    echo -e "${RED}✗ Extraction failed${NC}"
    FAILED=$((FAILED + 1))
    continue
  fi

  # Convert
  echo -e "${BLUE}[3/4] Converting...${NC}"
  if node scripts/convert-vtd-shapefile.cjs "$SHP_FILE" "$GEOJSON_FILE" 2>&1 | grep -q "Conversion complete"; then
    echo -e "${GREEN}✓ Converted${NC}"
  else
    echo -e "${RED}✗ Conversion failed${NC}"
    FAILED=$((FAILED + 1))
    continue
  fi

  # Import
  echo -e "${BLUE}[4/4] Importing...${NC}"
  if OUTPUT=$(node scripts/import-vtd-data.cjs "$GEOJSON_FILE" 2>&1); then
    VTD_COUNT=$(echo "$OUTPUT" | grep -o "Imported: [0-9]*" | grep -o "[0-9]*" || echo "0")
    TOTAL_VTDS=$((TOTAL_VTDS + VTD_COUNT))
    echo -e "${GREEN}✓ Imported $VTD_COUNT VTDs${NC}"
    PROCESSED=$((PROCESSED + 1))
  else
    echo -e "${RED}✗ Import failed${NC}"
    FAILED=$((FAILED + 1))
  fi

  # Cleanup
  rm -f "$ZIP_FILE" "$SHP_FILE" "$GEOJSON_FILE"
  rm -f temp-vtd-data/cb_2020_${FIPS}_vtd_500k.*

  echo ""
done

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

echo -e "${BLUE}==============================================================================${NC}"
echo -e "${BLUE}IMPORT COMPLETE${NC}"
echo -e "${BLUE}==============================================================================${NC}"
echo ""
echo -e "${GREEN}✓ Successfully imported: $PROCESSED states (TX, FL, NY)${NC}"
echo -e "${RED}✗ Failed: $FAILED states${NC}"
echo ""
echo -e "${BLUE}Total VTDs imported: $TOTAL_VTDS${NC}"
echo -e "${BLUE}Database size: ~$((TOTAL_VTDS * 16 / 1000))MB${NC}"
echo -e "${BLUE}Total time: ${MINUTES}m ${SECONDS}s${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 All top states imported successfully!${NC}"
  echo -e "${GREEN}   Coverage: Texas, Florida, New York (~30% of US population)${NC}"
else
  echo -e "${YELLOW}⚠️  Import completed with failures${NC}"
fi

echo ""
