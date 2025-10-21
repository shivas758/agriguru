# Commodity Images

Add commodity images to this folder to display them in the app.

## Naming Convention

Images should be named using **lowercase** with **hyphens** for spaces:

### Examples from your data:

- `cabbage.jpg` → for "Cabbage"
- `colacasia.jpg` → for "Colacasia"  
- `potato.jpg` → for "Potato"
- `brinjal.jpg` → for "Brinjal"
- `cauliflower.jpg` → for "Cauliflower"
- `green-chilli.jpg` → for "Green Chilli"
- `field-pea.jpg` → for "Field Pea"
- `cluster-beans.jpg` → for "Cluster beans"
- `cucumbarkheera.jpg` → for "Cucumbar(Kheera)" (special chars removed)
- `ridgeguardtori.jpg` → for "Ridgeguard(Tori)" (special chars removed)

### With Serial Numbers (Optional):

You can also organize with numbers:
- `1.cabbage.jpg`
- `2.potato.jpg`
- `3.brinjal.jpg`

## Image Specifications

- **Format**: JPG, PNG, WebP, or JPEG
- **Recommended Size**: 400x400 pixels (square)
- **Max File Size**: 200KB per image
- **Aspect Ratio**: 1:1 (square) preferred

## How It Works

1. The app automatically converts commodity names to lowercase
2. Removes special characters (parentheses, etc.)
3. Replaces spaces with hyphens
4. Looks for matching image file
5. If not found, shows default package icon

## Quick Start

To add images for the commodities shown in your Warangal market query:

```bash
# Navigate to this folder
cd public/commodities

# Add images with these names:
# cabbage.jpg
# colacasia.jpg
# potato.jpg
# brinjal.jpg
# cauliflower.jpg
# green-chilli.jpg
# field-pea.jpg
# cluster-beans.jpg
# cucumbarkheera.jpg
# ridgeguardtori.jpg
```

## Where to Get Images

1. **Free Stock Photos**:
   - [Unsplash](https://unsplash.com) - Search for vegetable names
   - [Pexels](https://pexels.com) - Free high-quality images
   - [Pixabay](https://pixabay.com) - Free images

2. **Government Resources**:
   - Agricultural department websites
   - ICAR (Indian Council of Agricultural Research)

3. **Create Your Own**:
   - Take photos at local markets
   - Use smartphone camera

## Testing

After adding images:
1. Refresh the browser (Ctrl+R or Cmd+R)
2. Query for the commodity
3. Image should appear in the price card
4. If not, check browser console for errors
