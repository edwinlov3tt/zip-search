# MapBox Geocoding Setup Guide

## Overview

Your ZIP Search application now supports **MapBox Geocoding API** for much more accurate autocomplete results, especially for US addresses. MapBox provides:

- ✅ **100,000 free requests/month** (very generous free tier)
- ✅ **Excellent US address coverage** (much better than Nominatim)
- ✅ **Real-time autocomplete with high accuracy**
- ✅ **Only $0.50 per 1,000 requests** after free tier
- ✅ **Automatic fallback to Nominatim** if MapBox fails

## Current Status

🟡 **MapBox Integration**: Ready but requires API key setup
- File: `/src/services/mapboxGeocodingService.js` ✅ Created
- Integration: Updated in `GeoApplication.jsx` ✅ Complete
- Fallback: Will use Nominatim if MapBox unavailable ✅ Working

## Quick Setup (5 minutes)

### Step 1: Get MapBox API Key

1. **Sign up at MapBox** (free): https://www.mapbox.com/
2. **Create an account** (can use GitHub/Google login)
3. **Go to Account → Access Tokens**: https://account.mapbox.com/access-tokens/
4. **Create a new token** or copy the default public token
5. **Copy your token** (looks like: `pk.eyJ1IjoieW91cnVzZXJuYW1lIiw...`)

### Step 2: Add API Key to Your App

**Option A: Environment Variable (Recommended)**

1. Create a `.env` file in your project root:
   ```bash
   cd /Users/edwinlovettiii/zip-search
   touch .env
   ```

2. Add your MapBox token to `.env`:
   ```bash
   VITE_MAPBOX_TOKEN=pk.eyJ1IjoieW91cnVzZXJuYW1lIiw...
   ```
   ⚠️ Replace `pk.eyJ1IjoieW91cnVzZXJuYW1lIiw...` with your actual token

3. Restart your development server:
   ```bash
   npm run dev
   ```

**Option B: Direct Code Update (Less Secure)**

Edit `/src/services/mapboxGeocodingService.js` line 8:
```javascript
this.apiKey = 'pk.eyJ1IjoieW91cnVzZXJuYW1lIiw...'; // Your actual token
```

### Step 3: Test the Setup

1. **Start your app**: `npm run dev`
2. **Go to Radius Search mode**
3. **Type an address**: Try "2366 Livorno Way, Land O Lakes, FL"
4. **Check console**: Should see MapBox results, no "falling back" messages

## Verification

### ✅ Working Signs:
- Address autocomplete shows detailed, accurate results
- No console warnings about "MapBox API key not configured"
- Your test address "2366 Livorno Way, Land O Lakes, FL 34639" appears in results
- Clicking autocomplete results triggers radius search automatically

### ❌ Not Working Signs:
- Console shows "MapBox API key not configured"
- Console shows "Falling back to Nominatim geocoding..."
- Address results are sparse or inaccurate

## API Key Security

### ✅ Safe Practices:
- Use environment variables (`.env` file)
- MapBox public tokens are safe for frontend use
- Never commit API keys to git repositories

### 🚨 Security Notes:
- MapBox **public tokens** (starting with `pk.`) are designed for frontend use
- They can be safely exposed in client-side code
- Set up **URL restrictions** in MapBox dashboard for production

## Rate Limits & Costs

### Free Tier (Very Generous):
- **100,000 requests/month** free
- Perfect for development and moderate production use
- No credit card required for free tier

### Paid Tier:
- **$0.50 per 1,000 requests** after free tier
- Example: 200k requests/month = $50/month
- Much cheaper than Google Maps API

## Troubleshooting

### Issue: "MapBox API key not configured"
**Solution**: Check that your API key is correctly set in `.env` file and server is restarted

### Issue: "Falling back to Nominatim"
**Causes**:
- API key not set
- Invalid API key
- Network issues
- Rate limit exceeded (unlikely with free tier)

### Issue: No autocomplete results
**Check**:
1. API key is valid
2. Query is at least 2 characters
3. Network connection is working
4. Browser console for error messages

## Advanced Configuration

### Customize Search Parameters

Edit `/src/services/mapboxGeocodingService.js` line 45-51:

```javascript
const params = new URLSearchParams({
  access_token: this.apiKey,
  limit: limit.toString(),
  country: 'US',     // Can add more: 'US,CA' for US+Canada
  types: 'address,place,postcode,locality,neighborhood', // Customize types
  autocomplete: 'true'
});
```

### URL Restrictions (Production)

In your MapBox dashboard:
1. Go to your access token
2. Add **URL restrictions**: `https://yourdomain.com/*`
3. This prevents unauthorized use of your API key

## Fallback Behavior

The app is designed with **automatic fallback**:

1. **Primary**: Try MapBox geocoding (if API key configured)
2. **Fallback**: Use Nominatim if MapBox fails
3. **User Experience**: Seamless - users won't notice the fallback

This ensures your app **always works**, even if:
- MapBox API key is not configured
- MapBox service is temporarily down
- You exceed your MapBox rate limits

## Next Steps

1. **Set up your API key** using the steps above
2. **Test with your problematic address**: "2366 Livorno Way, Land O Lakes, FL 34639"
3. **Verify radius search** works automatically after selection
4. **Monitor usage** in MapBox dashboard if you plan heavy use

The autocomplete should now be much more accurate and reliable!