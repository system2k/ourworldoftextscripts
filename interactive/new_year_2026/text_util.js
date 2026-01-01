var tileC = 16;
var tileR = 8;

function coordinateAdd(tileX1, tileY1, charX1, charY1, tileX2, tileY2, charX2, charY2) {
	return [
		tileX1 + tileX2 + Math.floor((charX1 + charX2) / tileC),
		tileY1 + tileY2 + Math.floor((charY1 + charY2) / tileR),
		(charX1 + charX2) - Math.floor((charX1 + charX2) / tileC) * tileC,
		(charY1 + charY2) - Math.floor((charY1 + charY2) / tileR) * tileR
	];
}

function propagatePosition(coords, char, noEnter, noVertPos) {
	// coords: {tileX, tileY, charX, charY}
	// char: <string>
	var newline = char == "\n" || char == "\r";
	if(newline && !noEnter) {
		coords.charY++;
		if(coords.charY >= tileR) {
			coords.charY = 0;
			coords.tileY++;
		}
		if(noVertPos) {
			coords.tileX = 0;
			coords.charX = 0;
		} else {
			coords.tileX = verticalEnterPos[0];
			coords.charX = verticalEnterPos[1];
		}
	} else {
		coords.charX++;
		if(coords.charX >= tileC) {
			coords.charX = 0;
			coords.tileX++;
		}
	}
	return coords;
}

function advancedSplit(str, noSurrog, noComb, norm) {
	if(str && str.constructor == Array) return str.slice(0);
	var chars = [];
	var buffer = "";
	var surrogMode = false;
	var charMode = false;
	var combCount = 0;
	var combLimit = 15;
	for(var i = 0; i < str.length; i++) {
		var char = str[i];
		var code = char.charCodeAt();
		if(code >= 0xDC00 && code <= 0xDFFF) {
			if(surrogMode) {
				buffer += char;
			} else {
				buffer = "";
				chars.push("?");
			}
			surrogMode = false;
			combCount = 0;
			continue;
		} else if(surrogMode) {
			buffer = "";
			chars.push("?");
			surrogMode = false;
			continue;
		}
		if(!noSurrog && code >= 0xD800 && code <= 0xDBFF) {
			if(charMode) {
				chars.push(buffer);
			}
			charMode = true;
			surrogMode = true;
			buffer = char;
			continue;
		}
		if(!norm && ((code >= 0x0300 && code <= 0x036F) ||
		  (code >= 0x1DC0 && code <= 0x1DFF) ||
		  (code >= 0x20D0 && code <= 0x20FF) ||
		  (code >= 0xFE20 && code <= 0xFE2F))) {
			if(!noComb && charMode && combCount < combLimit) {
				buffer += char;
				combCount++;
			}
			continue;
		} else {
			if(charMode) {
				chars.push(buffer);
			}
			combCount = 0;
			charMode = true;
			buffer = char;
		}
	}
	if(buffer) {
		chars.push(buffer);
	}
	return chars;
}

function textcode_parser(value, coords, defaultColor, defaultBgColor) {
	if(typeof value == "string") value = advancedSplit(value);
	var hex = "ABCDEF";
	var pasteColor = defaultColor;
	if(!pasteColor) pasteColor = 0;
	var pasteBgColor = defaultBgColor;
	if(pasteBgColor == void 0) pasteBgColor = -1;
	var index = 0;
	var off = {
		tileX: 0, tileY: 0,
		charX: 0, charY: 0
	};
	if(coords) {
		off.tileX = coords.tileX;
		off.tileY = coords.tileY;
		off.charX = coords.charX;
		off.charY = coords.charY;
	}
	var pos = {
		tileX: 0, tileY: 0,
		charX: 0, charY: 0
	};
	var next = function() {
		if(index >= value.length) return -1;
		var chr = value[index];
		var doWriteChar = true;
		var newline = true;
		if(chr == "\x1b") {
			doWriteChar = false;
			var hCode = value[index + 1];
			if(hCode == "$") { // contains links
				index += 2;
				var lType = value[index];
				index++;
				if(lType == "c") { // coord
					var strPoint = index;
					var buf = "";
					var mode = 0;
					while(true) {
						if(value[strPoint] == "[" && mode == 0) {
							mode = 1;
							if(++strPoint >= value.length) break;
							continue;
						}
						if(value[strPoint] == "]" && mode == 1) {
							strPoint++;
							break;
						}
						if(mode == 1) {
							buf += value[strPoint];
							if(++strPoint >= value.length) break;
							continue;
						}
						if(++strPoint >= value.length) break;
					}
					index = strPoint;
					buf = buf.split(",");
					var coordTileX = parseFloat(buf[0].trim());
					var coordTileY = parseFloat(buf[1].trim());
					var charPos = coordinateAdd(pos.tileX, pos.tileY, pos.charX, pos.charY,
						off.tileX, off.tileY, off.charX, off.charY);
					return {
						type: "link",
						linkType: "coord",
						tileX: charPos[0],
						tileY: charPos[1],
						charX: charPos[2],
						charY: charPos[3],
						coord_tileX: coordTileX,
						coord_tileY: coordTileY
					};
				} else if(lType == "u") { // urllink
					var strPoint = index;
					var buf = "";
					var quotMode = 0;
					while(true) {
						if(value[strPoint] == "\"" && quotMode == 0) {
							quotMode = 1;
							if(++strPoint >= value.length) break;
							continue;
						}
						if(value[strPoint] == "\"" && quotMode == 1) {
							strPoint++;
							break;
						}
						if(quotMode == 1) {
							if(value[strPoint] == "\\") {
								quotMode = 2;
								if(++strPoint >= value.length) break;
								continue;
							}
							buf += value[strPoint];
						}
						if(quotMode == 2) {
							buf += value[strPoint];
							quotMode = 1;
							if(++strPoint >= value.length) break;
							continue;
						}
						if(++strPoint >= value.length) break;
					}
					index = strPoint;
					var charPos = coordinateAdd(pos.tileX, pos.tileY, pos.charX, pos.charY,
						off.tileX, off.tileY, off.charX, off.charY);
					return {
						type: "link",
						linkType: "url",
						tileX: charPos[0],
						tileY: charPos[1],
						charX: charPos[2],
						charY: charPos[3],
						url: buf
					};
				}
			} else if(hCode == "P") { // contains area protections
				index += 2;
				var protType = parseInt(value[index]);
				index++;
				if(isNaN(protType)) protType = 0;
				if(!(protType >= 0 && protType <= 2)) protType = 0;
				var charPos = coordinateAdd(pos.tileX, pos.tileY, pos.charX, pos.charY,
					off.tileX, off.tileY, off.charX, off.charY);
				return {
					type: "protect",
					protType: protType,
					tileX: charPos[0],
					tileY: charPos[1],
					charX: charPos[2],
					charY: charPos[3]
				};
			} else if(hCode == "*") { // skip character
				index += 2;
				chr = " ";
				doWriteChar = false;
			} else if(hCode == "x" || (hCode >= "A" && hCode <= "F")) { // colored paste
				var cCol = "";
				if(hCode == "x") {
					cCol = "000000";
					pasteBgColor = -1;
					if(defaultBgColor != void 0) {
						pasteBgColor = defaultBgColor;
					}
					index += 2;
				} else { // we use 'F' now, which indicates a length of 6.
					var code = hex.indexOf(hCode);
					if(code > -1) {
						cCol = value.slice(index + 2, index + 2 + code + 1).join("");
						index += code + 1; // index 5 plus one.
					}
					index += 2;
				}
				pasteColor = parseInt(cCol, 16);
				return {
					type: "yield"
				};
			} else if(hCode == "b") { // background cell color
				var bCol = value.slice(index + 2, index + 2 + 6).join("");
				index += 6 + 2;
				pasteBgColor = parseInt(bCol, 16);
				if(isNaN(pasteBgColor)) pasteBgColor = -1;
				return {
					type: "yield"
				};
			} else {
				index += 2;
				doWriteChar = true;
				if(hCode == "\n") { // paste newline character itself
					chr = "\n";
					newline = false;
				} else if(hCode == "\r") { // paste carriage return character itself
					chr = "\r";
					newline = false;
				} else if(hCode == "\x1b") { // paste ESC character itself
					chr = "\x1b";
				} else {
					chr = hCode;
				}
			}
		} else if(chr.codePointAt(0) >= 0x1F1E6 && chr.codePointAt(0) <= 0x1F1FF) { // flag emojis
			index++;
			while(true) { // TODO: refactor
				if(index >= value.length) break;
				var f2 = value[index];
				if(!(f2.codePointAt(0) >= 0x1F1E6 && f2.codePointAt(0) <= 0x1F1FF)) {
					//index--;
					break;
				}
				var alpha1 = chr.codePointAt(0) - 0x1F1E6;
				var alpha2 = f2.codePointAt(0) - 0x1F1E6;
				var residue = f2.slice(2); // combining characters / formatting
				chr = String.fromCodePoint(0xFF000 + (alpha1 * 26) + alpha2) + residue; // private use area
				index++;
				break;
			}
		} else {
			index++;
		}
		var charPos = coordinateAdd(pos.tileX, pos.tileY, pos.charX, pos.charY,
			off.tileX, off.tileY, off.charX, off.charY);
		propagatePosition(pos, chr, false, true);
		return {
			type: "char",
			char: chr,
			color: pasteColor,
			bgColor: pasteBgColor,
			writable: doWriteChar,
			newline: newline, // if false, interpret newline characters as characters
			tileX: charPos[0],
			tileY: charPos[1],
			charX: charPos[2],
			charY: charPos[3]
		};
	}
	return {
		next: next,
		nextItem: function() {
			while(true) {
				var item = next();
				if(item == -1) return -1;
				if(item.type == "yield") continue;
				return item;
			}
		}
	};
}

module.exports = {
	coordinateAdd,
	advancedSplit,
	textcode_parser
};