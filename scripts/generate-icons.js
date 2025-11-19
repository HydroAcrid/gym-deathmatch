#!/usr/bin/env node
/**
 * Generate PWA icons from SVG template
 * Run: node scripts/generate-icons.js
 * Requires: sharp (npm install sharp --save-dev)
 */

const fs = require('fs');
const path = require('path');

// Dumbbell SVG icon template
const svgIcon = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <!-- Dark background -->
  <rect width="512" height="512" fill="#140b07"/>
  
  <!-- Dumbbell body (horizontal bar) -->
  <rect x="120" y="240" width="272" height="32" rx="16" fill="#f26b2a"/>
  
  <!-- Left weight -->
  <rect x="60" y="200" width="80" height="112" rx="12" fill="#f26b2a"/>
  <rect x="70" y="210" width="60" height="92" rx="8" fill="#140b07"/>
  
  <!-- Right weight -->
  <rect x="372" y="200" width="80" height="112" rx="12" fill="#f26b2a"/>
  <rect x="382" y="210" width="60" height="92" rx="8" fill="#140b07"/>
  
  <!-- Center grip detail -->
  <rect x="200" y="244" width="112" height="24" rx="4" fill="#140b07"/>
</svg>`;

async function generateIcons() {
	try {
		// Try to use sharp if available
		const sharp = require('sharp');
		const iconsDir = path.join(process.cwd(), 'public', 'icons');
		
		// Ensure directory exists
		if (!fs.existsSync(iconsDir)) {
			fs.mkdirSync(iconsDir, { recursive: true });
		}
		
		const buffer = Buffer.from(svgIcon);
		
		// Generate 192x192
		await sharp(buffer)
			.resize(192, 192)
			.png()
			.toFile(path.join(iconsDir, 'icon-192.png'));
		
		// Generate 512x512
		await sharp(buffer)
			.resize(512, 512)
			.png()
			.toFile(path.join(iconsDir, 'icon-512.png'));
		
		console.log('✅ Icons generated successfully!');
	} catch (error) {
		if (error.code === 'MODULE_NOT_FOUND') {
			console.log('⚠️  sharp not found. Installing...');
			console.log('Run: npm install sharp --save-dev');
			console.log('Or use the HTML generator: open public/icons/generate-icons.html in a browser');
		} else {
			console.error('Error generating icons:', error);
		}
	}
}

generateIcons();

