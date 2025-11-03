#!/bin/bash
###############################################################################
# Import All States VTD Data
# Downloads, converts, and imports VTD boundaries for all 50 states + DC + PR
#
# Requirements:
# - SUPABASE_SERVICE_ROLE_KEY environment variable
# - Node.js installed
# - curl installed
# - unzip installed
#
# Estimated time: 2 hours
# Estimated database size: 1.66GB - 2.5GB
# Requires: Supabase Pro plan ($25/month) for 8GB database
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check requirements
echo -e "${BLUE}==============================================================================${NC}"
echo -e "${BLUE}VTD All States Import Script${NC}"
echo -e "${BLUE}==============================================================================${NC}"
echo ""

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo -e "${RED}ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable not set${NC}"
  echo "Set it with: export SUPABASE_SERVICE_ROLE_KEY=\"your-key-here\""
  exit 1
fi

# Create temp directory
mkdir -p temp-vtd-data

# State list: FIPS:Name
STATES=(
  "01:Alabama"
  "02:Alaska"
  "04:Arizona"
  "05:Arkansas"
  "08:Colorado"
  "09:Connecticut"
  "10:Delaware"
  "11:DistrictOfColumbia"
  "12:Florida"
  "13:Georgia"
  "15:Hawaii"
  "16:Idaho"
  "17:Illinois"
  "18:Indiana"
  "19:Iowa"
  "20:Kansas"
  "22:Louisiana"
  "23:Maine"
  "24:Maryland"
  "25:Massachusetts"
  "26:Michigan"
  "27:Minnesota"
  "28:Mississippi"
  "29:Missouri"
  "30:Montana"
  "31:Nebraska"
  "32:Nevada"
  "33:NewHampshire"
  "34:NewJersey"
  "35:NewMexico"
  "36:NewYork"
  "37:NorthCarolina"
  "38:NorthDakota"
  "39:Ohio"
  "40:Oklahoma"
  "42:Pennsylvania"
  "45:SouthCarolina"
  "46:SouthDakota"
  "47:Tennessee"
  "48:Texas"
  "49:Utah"
  "50:Vermont"
  "51:Virginia"
  "53:Washington"
  "54:WestVirginia"
  "55:Wisconsin"
  "56:Wyoming"
  "72:PuertoRico"
)

# Skip states (no VTD data available)
SKIP_STATES=("California" "Oregon" "Kentucky" "RhodeIsland")

# Track statistics
TOTAL_STATES=${#STATES[@]}
PROCESSED=0
SKIPPED=0
FAILED=0
TOTAL_VTDS=0

START_TIME=$(date +%s)

echo -e "${BLUE}Total states to process: $TOTAL_STATES${NC}"
echo -e "${BLUE}Starting import...${NC}"
echo ""

# Process each state
for state in "${STATES[@]}"; do
  FIPS="${state%%:*}"
  NAME="${state##*:}"

  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}Processing: $NAME (FIPS: $FIPS) [$(($PROCESSED + $SKIPPED + $FAILED + 1))/$TOTAL_STATES]${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  # Check if state should be skipped
  SHOULD_SKIP=0
  for skip in "${SKIP_STATES[@]}"; do
    if [[ "$NAME" == "$skip" ]]; then
      SHOULD_SKIP=1
      break
    fi
  done

  if [ $SHOULD_SKIP -eq 1 ]; then
    echo -e "${YELLOW}⊘ Skipping $NAME (no VTD data available)${NC}"
    SKIPPED=$((SKIPPED + 1))
    echo ""
    continue
  fi

  # Check if already imported (Texas is already done)
  if [ "$NAME" == "Texas" ]; then
    echo -e "${GREEN}✓ Texas already imported (9,007 VTDs)${NC}"
    PROCESSED=$((PROCESSED + 1))
    TOTAL_VTDS=$((TOTAL_VTDS + 9007))
    echo ""
    continue
  fi

  # Download shapefile
  echo -e "${BLUE}[1/3] Downloading shapefile...${NC}"
  ZIP_FILE="temp-vtd-data/${NAME}_vtd.zip"
  DOWNLOAD_URL="https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_${FIPS}_vtd_500k.zip"

  if curl -f -o "$ZIP_FILE" "$DOWNLOAD_URL" 2>/dev/null; then
    echo -e "${GREEN}✓ Downloaded${NC}"
  else
    echo -e "${RED}✗ Download failed for $NAME${NC}"
    FAILED=$((FAILED + 1))
    echo ""
    continue
  fi

  # Unzip
  echo -e "${BLUE}[2/3] Extracting shapefile...${NC}"
  if unzip -o -q "$ZIP_FILE" -d temp-vtd-data/ 2>/dev/null; then
    echo -e "${GREEN}✓ Extracted${NC}"
  else
    echo -e "${RED}✗ Extraction failed for $NAME${NC}"
    FAILED=$((FAILED + 1))
    echo ""
    continue
  fi

  # Convert to GeoJSON
  echo -e "${BLUE}[3/3] Converting to GeoJSON...${NC}"
  SHP_FILE="temp-vtd-data/cb_2020_${FIPS}_vtd_500k.shp"
  GEOJSON_FILE="temp-vtd-data/${NAME}-vtd.geojson"

  if node scripts/convert-vtd-shapefile.cjs "$SHP_FILE" "$GEOJSON_FILE" 2>&1 | grep -q "Conversion complete"; then
    echo -e "${GREEN}✓ Converted${NC}"
  else
    echo -e "${RED}✗ Conversion failed for $NAME${NC}"
    FAILED=$((FAILED + 1))
    echo ""
    continue
  fi

  # Import to Supabase
  echo -e "${BLUE}[4/4] Importing to Supabase...${NC}"
  if OUTPUT=$(node scripts/import-vtd-data.cjs "$GEOJSON_FILE" 2>&1); then
    # Extract VTD count from output
    VTD_COUNT=$(echo "$OUTPUT" | grep -o "Imported: [0-9]*" | grep -o "[0-9]*" || echo "0")
    TOTAL_VTDS=$((TOTAL_VTDS + VTD_COUNT))

    echo -e "${GREEN}✓ Imported $VTD_COUNT VTDs${NC}"
    PROCESSED=$((PROCESSED + 1))
  else
    echo -e "${RED}✗ Import failed for $NAME${NC}"
    FAILED=$((FAILED + 1))
  fi

  # Cleanup to save space
  rm -f "$ZIP_FILE" "$SHP_FILE" "$GEOJSON_FILE"
  rm -f temp-vtd-data/cb_2020_${FIPS}_vtd_500k.*

  echo ""
done

# Calculate totals
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

# Final summary
echo -e "${BLUE}==============================================================================${NC}"
echo -e "${BLUE}IMPORT COMPLETE${NC}"
echo -e "${BLUE}==============================================================================${NC}"
echo ""
echo -e "${GREEN}✓ Successfully imported: $PROCESSED states${NC}"
echo -e "${YELLOW}⊘ Skipped (no data): $SKIPPED states${NC}"
echo -e "${RED}✗ Failed: $FAILED states${NC}"
echo ""
echo -e "${BLUE}Total VTDs imported: $TOTAL_VTDS${NC}"
echo -e "${BLUE}Total time: ${MINUTES}m ${SECONDS}s${NC}"
echo ""

# Estimate database size
DB_SIZE_MB=$((TOTAL_VTDS * 16600 / 1024 / 1024))
echo -e "${BLUE}Estimated database size: ${DB_SIZE_MB}MB${NC}"
echo ""

# Final status
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 All states imported successfully!${NC}"
else
  echo -e "${YELLOW}⚠️  Import completed with $FAILED failures${NC}"
  echo -e "${YELLOW}   You may want to re-run failed states individually${NC}"
fi

echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "  1. Test VTD loading with searches in different states"
echo -e "  2. Monitor Supabase database usage"
echo -e "  3. Update UI to reflect nationwide coverage"
echo ""
