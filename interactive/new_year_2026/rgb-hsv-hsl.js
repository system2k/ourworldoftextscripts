// [0, 255], [0,255], [0,255] -> [0, 360), [0, 1], [0, 1]
function rgb_to_hsv(r, g, b) {
	r /= 255;
	g /= 255;
	b /= 255;
	var max = Math.max(r, g, b);
	var min = Math.min(r, g, b);
	var diff = max - min;
	var h = 0;
	var s = 0;
	var v = max;
	if(max == min) {
		h = 0;
	} else if(max == r) {
		h = (60 * ((g - b) / diff) + 360) % 360;
	} else if(max == g) {
		h = (60 * ((b - r) / diff) + 120) % 360;
	} else if(max == b) {
		h = (60 * ((r - g) / diff) + 240) % 360;
	}
	if(max == 0) {
		s = 0;
	} else {
		s = (diff / max);
	}
	return [h, s, v];
}

// [0, 360), [0, 1], [0, 1] -> [0, 255], [0,255], [0,255]
function hsv_to_rgb(h, s, v) {
	h /= 60;
	var chroma = v * s;
	var x = chroma * (1 - Math.abs(h % 2 - 1));
	var angle = Math.floor(h % 6);
	var r, g, b;
	switch(angle) {
		case 0: r = chroma; g = x; b = 0; break;
		case 1: r = x; g = chroma; b = 0; break;
		case 2: r = 0; g = chroma; b = x; break;
		case 3: r = 0; g = x; b = chroma; break;
		case 4: r = x; g = 0; b = chroma; break;
		case 5: r = chroma; g = 0; b = x; break;
	}
	var m = v - chroma;
	return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

// [0, 255], [0,255], [0,255] -> [0, 360), [0, 1], [0, 1]
function rgb_to_hsl(r, g, b) {
	r /= 255;
	g /= 255;
	b /= 255;
	var max = Math.max(r, g, b);
	var min = Math.min(r, g, b);
	var diff = max - min;
	var h = 0;
	var s = 0;
	var l = (min + max) / 2;
	if(r == max) {
		h = (g - b) / diff;
	} else if(g == max) {
		h = 2 + (b - r) / diff;
	} else if(b == max) {
		h = 4 + (r - g) / diff;
	}
	h = Math.min(h * 60, 360);
	if(h < 0) {
		h += 360;
	}
	l = (min + max) / 2;
	if(l <= 0.5) {
		s = diff / (max + min);
	} else {
		s = diff / (2 - max - min);
	}
	return [h, s, l];
}

// [0, 360), [0, 1], [0, 1] -> [0, 255], [0,255], [0,255]
function hsl_to_rgb(h, s, l) {
	h /= 60;
	var chroma = (1 - Math.abs(2 * l - 1)) * s;
	var x = chroma * (1 - Math.abs(h % 2 - 1));
	var angle = Math.floor(h % 6);
	var r, g, b;
	switch(angle) {
		case 0: r = chroma; g = x; b = 0; break;
		case 1: r = x; g = chroma; b = 0; break;
		case 2: r = 0; g = chroma; b = x; break;
		case 3: r = 0; g = x; b = chroma; break;
		case 4: r = x; g = 0; b = chroma; break;
		case 5: r = chroma; g = 0; b = x; break;
	}
	var m = l - chroma / 2;
	return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

module.exports = {
	rgb_to_hsv,
	hsv_to_rgb,
	rgb_to_hsl,
	hsl_to_rgb
};