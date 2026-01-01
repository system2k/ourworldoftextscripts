var WebSocket = require("ws");
var fs = require("fs");
var owotAuth = require("./auth/auth.js");

var utils = require("./text_util.js");
var colorUtil = require("./rgb-hsv-hsl.js");

var timezonesRaw = fs.readFileSync("./timezones.csv").toString("utf8").replace(/\r\n/g, "\n").split("\n");

var textcode_parser = utils.textcode_parser;
var advancedSplit = utils.advancedSplit;
var coordinateAdd = utils.coordinateAdd;

var rgb_to_hsv = colorUtil.rgb_to_hsv;
var hsv_to_rgb = colorUtil.hsv_to_rgb;
var rgb_to_hsl = colorUtil.rgb_to_hsl;
var hsl_to_rgb = colorUtil.hsl_to_rgb;

const str_yr = "2026";
const title = "2026 countdown";
const epochTime = new Date("January 1, 2026 UTC").getTime();
const socketPath = "wss://ourworldoftext.com/owot/2026countdown/ws/";
const member_bg_color = 0x4095C9;

/*
debugEpoch samples
new Date("December 31, 2023 11:59:50 PM GMT+10:30").getTime() - Date.now();
new Date("December 31, 2023 11:59:50 PM EST").getTime() - Date.now();
new Date("December 31, 2023 11:59:50 PM GMT-12").getTime() - Date.now();
*/

var debugEpoch = 0;
function getDate() {
	return debugEpoch + Date.now();
}

var hourLen = 3600000;
var minuteLen = 1000 * 60;


var tzAbbr = {};
var tzOrder = [];
var tzName = {};

for(var i = 0; i < timezonesRaw.length; i++) {
	var tz = timezonesRaw[i].split(",");
	var abbr = tz[0];
	var name = tz[1];
	var off = tz[2];
	
	var sign = off.charAt(0);
	var off2 = off.slice(1).split(":");
	
	var offVal = parseInt(off2[0]) * 60;
	if(off2.length > 1) {
		offVal += parseInt(off2[1]);
	}
	if(sign == "-") {
		offVal = -offVal;
	} else if(sign != "+") {
		throw "Unrecognized sign: " + sign;
	}
	
	//console.log(abbr, name, offVal);
	if(!tzAbbr[offVal]) {
		tzAbbr[offVal] = [];
		tzOrder.push(offVal);
	}
	if(!tzAbbr[offVal].includes(abbr)) tzAbbr[offVal].push(abbr);
	
	if(!tzName[abbr]) {
		tzName[abbr] = [];
	}
	tzName[abbr].push([name, offVal]);
}

// time zone list goes from positive (earliest) to negative (latest)
tzOrder.sort((x, y) => y - x);


var chars = {
	block: "\u2588",
	roundTopLeft: "\u256d",
	roundBottomLeft: "\u2570",
	roundTopRight: "\u256e",
	roundBottomRight: "\u256f",
	barHorz: "\u2500",
	barVert: "\u2502",
	leftHalf: "\u258c"
};

function importTextFile(path) {
	var rawdata = fs.readFileSync(path).toString("utf8").replace(/\r\n/g, "\n");
	var processed = [];
	var parser = textcode_parser(rawdata);
	while(true) {
		var data = parser.nextItem();
		if(data == -1) break;
		if(data.type != "char") continue;
		if(data.char == "\n" || data.char == "\r") continue;
		var absX = data.tileX * 16 + data.charX;
		var absY = data.tileY * 8 + data.charY;
		processed.push([absX, absY, data.char, data.color, data.bgColor]);
	}
	return processed;
}

var artData = {
	worldMap: importTextFile("./world-map.txt")
};
var numset = fs.readFileSync("./numbers.txt").toString("utf8").replace(/\r\n/g, "\n").split("\n");
var ballTemplate = fs.readFileSync("./ball.txt").toString("utf8").replace(/\r\n/g, "\n").split("\n");


var dimensions = {
	w: 128,
	h: 40
};

var position = {
	x: -64,
	y: -20
};


var tzCoords = {
	"0": [[17,0],[18,0],[19,0],[20,0],[21,0],[17,1],[18,1],[19,1],[20,1],[21,1],[18,2],[19,2],[20,2],[21,2],[19,3],[20,3],[21,3],[18,4],[19,4],[18,5],[19,5],[20,5],[18,6],[19,6],[20,6],[21,6],[18,7],[19,7],[20,7],[21,7],[19,8],[20,8],[21,8],[19,9],[20,9],[21,9],[18,10],[19,10],[20,10],[21,10],[19,11],[20,11],[21,11]],
	"60": [[21,0],[22,0],[23,0],[24,0],[19,1],[20,1],[21,1],[22,1],[23,1],[19,2],[20,2],[21,2],[22,2],[23,2],[19,3],[20,3],[21,3],[22,3],[18,4],[19,4],[20,4],[21,4],[22,4],[18,5],[19,5],[20,5],[21,5],[22,5],[23,5],[20,6],[21,6],[22,6],[23,6],[20,7],[21,7],[22,7],[23,7],[21,8],[22,8],[23,8],[21,9],[22,9],[21,10],[22,10],[21,11],[22,11]],
	"120": [[22,0],[23,0],[24,0],[22,1],[23,1],[24,1],[22,2],[23,2],[24,2],[22,3],[23,3],[24,3],[21,4],[22,4],[23,4],[24,4],[21,5],[22,5],[23,5],[24,5],[22,6],[23,6],[24,6],[22,7],[23,7],[24,7],[25,7],[21,8],[22,8],[23,8],[24,8],[25,8],[21,9],[22,9],[23,9],[24,9],[22,10],[23,10],[24,10],[22,11],[23,11],[24,11]],
	"180": [[24,0],[25,0],[26,0],[27,0],[28,0],[23,1],[24,1],[25,1],[26,1],[27,1],[28,1],[23,2],[24,2],[25,2],[26,2],[23,3],[24,3],[25,3],[26,3],[24,4],[25,4],[26,4],[24,5],[25,5],[26,5],[23,6],[24,6],[25,6],[26,6],[23,7],[24,7],[25,7],[26,7],[24,8],[25,8],[26,8],[24,9],[25,9],[26,9],[24,10],[25,10],[26,10],[24,11],[25,11],[26,11]],
	"210": [[25,3],[26,3],[27,3],[25,4],[26,4],[27,4]],
	"240": [[26,0],[27,0],[28,0],[26,1],[27,1],[28,1],[25,2],[26,2],[25,3],[26,3],[26,4],[27,4],[28,4],[26,5],[27,5],[28,5],[26,6],[27,6],[28,6],[25,7],[26,7],[27,7],[28,7],[26,8],[27,8],[28,8],[26,9],[27,9],[28,9],[26,10],[27,10],[28,10],[26,11],[27,11],[28,11]],
	"270": [[27,3],[28,3],[29,3],[27,4],[28,4]],
	"300": [[28,0],[29,0],[26,1],[27,1],[28,1],[29,1],[30,1],[25,2],[26,2],[27,2],[28,2],[29,2],[26,3],[27,3],[28,3],[29,3],[27,4],[28,4],[29,4],[28,5],[29,5],[28,6],[29,6],[28,7],[29,7],[28,8],[29,8],[28,9],[29,9],[26,10],[28,10],[29,10],[28,11],[29,11]],
	"330": [[28,4],[29,4],[30,4],[31,4],[28,5],[29,5],[30,5],[31,5],[28,6],[29,6],[31,6]],
	"360": [[30,0],[31,0],[27,2],[28,2],[29,2],[30,2],[27,3],[28,3],[29,3],[30,3],[31,3],[29,4],[30,4],[31,4],[30,5],[31,5],[30,6],[31,6],[30,7],[31,7],[30,8],[31,8],[30,9],[31,9],[30,10],[31,10],[30,11],[31,11]],
	"390": [[31,4],[31,5],[32,5],[31,6],[32,6],[31,7],[31,8]],
	"420": [[29,0],[30,0],[31,0],[32,0],[33,0],[29,1],[30,1],[31,1],[32,1],[33,1],[29,2],[30,2],[31,2],[32,2],[31,3],[31,5],[32,5],[33,5],[31,6],[32,6],[33,6],[31,7],[32,7],[33,7],[34,7],[31,8],[32,8],[33,8],[31,9],[32,9],[33,9],[31,10],[32,10],[33,10],[31,11],[32,11],[33,11]],
	"480": [[33,0],[34,0],[35,0],[32,1],[33,1],[34,1],[30,2],[31,2],[32,2],[33,2],[34,2],[35,2],[36,2],[29,3],[30,3],[31,3],[32,3],[33,3],[34,3],[35,3],[36,3],[29,4],[30,4],[31,4],[32,4],[33,4],[34,4],[35,4],[32,5],[33,5],[34,5],[35,5],[31,6],[32,6],[33,6],[34,6],[35,6],[33,7],[34,7],[35,7],[33,8],[34,8],[35,8],[33,9],[34,9],[35,9],[33,10],[34,10],[35,10],[33,11],[34,11],[35,11]],
	"540": [[33,0],[34,0],[35,0],[36,0],[37,0],[32,1],[33,1],[34,1],[35,1],[36,1],[33,2],[34,2],[35,2],[36,2],[37,2],[35,3],[36,3],[37,3],[34,4],[35,4],[36,4],[37,4],[38,4],[35,5],[36,5],[37,5],[35,6],[36,6],[37,6],[34,7],[35,7],[36,7],[37,7],[35,8],[36,8],[37,8],[35,9],[36,9],[35,10],[36,10],[37,10],[35,11],[36,11],[37,11]],
	"570": [[35,7],[36,7],[35,8],[36,8],[35,9],[36,9]],
	"600": [[35,0],[36,0],[37,0],[38,0],[39,0],[35,1],[36,1],[37,1],[38,1],[35,2],[36,2],[37,2],[38,2],[35,3],[36,3],[37,3],[38,3],[37,4],[38,4],[37,5],[38,5],[36,6],[37,6],[38,6],[37,7],[38,7],[36,8],[37,8],[38,8],[36,9],[37,9],[38,9],[37,10],[38,10],[37,11],[38,11]],
	"630": [[35,9],[36,9],[37,9],[36,10]],
	"660": [[37,0],[38,0],[39,0],[40,0],[36,1],[37,1],[38,1],[39,1],[40,1],[37,2],[38,2],[39,2],[40,2],[37,3],[38,3],[39,3],[40,3],[38,4],[39,4],[40,4],[38,5],[39,5],[40,5],[38,6],[39,6],[40,6],[38,7],[39,7],[40,7],[38,8],[39,8],[40,8],[37,9],[38,9],[39,9],[40,9],[37,10],[38,10],[39,10],[40,10],[38,11],[39,11],[40,11]],
	"720": [[40,0],[41,0],[0,1],[39,1],[40,1],[41,1],[38,2],[39,2],[40,2],[41,2],[40,3],[41,3],[40,4],[41,4],[39,5],[40,5],[41,5],[39,6],[40,6],[41,6],[40,7],[41,7],[40,8],[41,8],[40,9],[41,9],[40,10],[41,10],[40,11],[41,11]],
	"780": [[41,8],[40,9],[41,9],[40,10],[41,10],[39,11],[40,11],[41,11]],
	"840": [[1,6],[1,7],[2,7]],
	"-720": [[41,0],[41,1],[41,2],[41,3],[41,4],[41,5],[41,6],[41,7],[41,8],[41,9],[41,10],[41,11]],
	"-660": [[0,0],[1,0],[0,1],[1,1],[0,2],[1,2],[0,3],[1,3],[0,4],[1,4],[41,4],[0,5],[1,5],[0,6],[1,6],[0,7],[1,7],[0,8],[1,8],[0,9],[1,9],[0,10],[1,10],[0,11],[1,11]],
	"-600": [[1,0],[2,0],[3,0],[2,1],[3,1],[1,2],[2,2],[3,2],[40,2],[41,2],[1,3],[2,3],[3,3],[0,4],[1,4],[2,4],[3,4],[0,5],[1,5],[2,5],[3,5],[1,6],[2,6],[3,6],[0,7],[1,7],[2,7],[3,7],[0,8],[1,8],[2,8],[3,8],[1,9],[2,9],[3,9],[1,10],[2,10],[3,10],[1,11],[2,11],[3,11]],
	"-570": [[3,7]],
	"-540": [[1,0],[3,0],[4,0],[0,1],[1,1],[2,1],[3,1],[4,1],[0,2],[1,2],[2,2],[3,2],[4,2],[3,3],[4,3],[3,4],[4,4],[3,5],[4,5],[3,6],[4,6],[3,7],[4,7],[3,8],[4,8],[3,9],[4,9],[3,10],[4,10],[3,11],[4,11]],
	"-480": [[5,0],[6,0],[3,1],[4,1],[3,2],[4,2],[5,2],[6,2],[5,3],[6,3],[5,4],[6,4],[5,5],[6,5],[5,6],[6,6],[5,7],[6,7],[4,8],[5,8],[6,8],[4,9],[5,9],[6,9],[5,10],[6,10],[5,11],[6,11]],
	"-420": [[4,0],[5,0],[6,0],[7,0],[8,0],[9,0],[3,1],[4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[5,2],[6,2],[7,2],[6,3],[7,3],[8,3],[6,4],[7,4],[6,5],[7,5],[8,5],[6,6],[7,6],[8,6],[6,7],[7,7],[8,7],[6,8],[7,8],[8,8],[6,9],[7,9],[8,9],[6,10],[7,10],[8,10],[6,11],[7,11],[8,11]],
	"-360": [[8,0],[9,0],[10,0],[7,1],[8,1],[9,1],[10,1],[7,2],[8,2],[9,2],[10,2],[7,3],[8,3],[9,3],[10,3],[7,4],[8,4],[9,4],[10,4],[7,5],[8,5],[9,5],[10,5],[8,6],[9,6],[10,6],[8,7],[9,7],[10,7],[8,8],[9,8],[10,8],[8,9],[9,9],[10,9],[8,10],[9,10],[10,10],[8,11],[9,11],[10,11]],
	"-300": [[9,0],[10,0],[11,0],[12,0],[13,0],[9,1],[10,1],[11,1],[12,1],[9,2],[10,2],[11,2],[12,2],[9,3],[10,3],[11,3],[12,3],[10,4],[11,4],[12,4],[9,5],[10,5],[11,5],[12,5],[10,6],[11,6],[12,6],[10,7],[11,7],[12,7],[10,8],[11,8],[7,9],[10,9],[11,9],[10,10],[11,10],[10,11],[11,11],[12,11]],
	"-240": [[11,0],[12,0],[13,0],[12,1],[13,1],[12,2],[13,2],[11,3],[12,3],[13,3],[12,4],[13,4],[11,5],[12,5],[13,5],[11,6],[12,6],[13,6],[11,7],[12,7],[13,7],[14,7],[11,8],[12,8],[13,8],[14,8],[13,9],[12,10],[13,10],[12,11],[13,11]],
	"-210": [[13,2],[13,3]],
	"-180": [[12,0],[13,0],[14,0],[15,0],[16,0],[17,0],[18,0],[13,1],[14,1],[15,1],[16,1],[17,1],[13,2],[14,2],[15,2],[13,3],[14,3],[15,3],[13,4],[14,4],[15,4],[13,5],[14,5],[15,5],[13,6],[14,6],[15,6],[13,7],[14,7],[15,7],[16,7],[11,8],[12,8],[13,8],[14,8],[15,8],[10,9],[11,9],[12,9],[13,9],[14,9],[15,9],[11,10],[12,10],[13,10],[14,10],[15,10],[11,11],[12,11],[13,11],[14,11],[15,11]],
	"-120": [[15,1],[16,1],[17,1],[15,2],[16,2],[17,2],[15,3],[16,3],[17,3],[15,4],[16,4],[17,4],[15,5],[16,5],[17,5],[15,6],[16,6],[17,6],[15,7],[16,7],[17,7],[15,8],[16,8],[17,8],[15,9],[16,9],[17,9],[15,10],[16,10],[17,10],[15,11],[16,11],[17,11]],
	"-60": [[17,0],[18,0],[19,0],[17,1],[18,1],[19,1],[17,2],[18,2],[19,2],[16,3],[17,3],[18,3],[19,3],[17,4],[18,4],[19,4],[17,5],[18,5],[17,6],[18,6],[19,6],[17,7],[18,7],[19,7],[17,8],[18,8],[19,8],[17,9],[18,9],[19,9],[17,10],[18,10],[19,10],[17,11],[18,11],[19,11]]
};

var tzHSLVals = {};

for(var i = 0; i < tzOrder.length; i++) {
	var tzOff = tzOrder[i];
	tzHSLVals[tzOff] = [Math.random() * 360, 0.704, 0.278];
}


var mapFrameGradient = [
	0xBBC422, 0xBEC721, 0xC0CA1F, 0xC2CC1E, 0xC5CF1C, 0xC7D11B, 0xC9D419, 0xCCD618,
	0xCED916, 0xD1DC15, 0xD3DE13, 0xD5E112, 0xD8E310, 0xDAE60F, 0xDCE80D, 0xDFEB0C,
	0xE1EE0A, 0xE3F009, 0xE6F307, 0xE8F506, 0xEAF804, 0xEDFA02, 0xEFFD01, 0xF0FE00,
	0xEEFC02, 0xECF903, 0xE9F705, 0xE7F406, 0xE5F108, 0xE2EF09, 0xE0EC0B, 0xDDEA0C,
	0xDBE70E, 0xD9E50F, 0xD6E211, 0xD4DF13, 0xD2DD14, 0xCFDA15, 0xCDD817, 0xCBD519,
	0xC8D31A, 0xC6D01C, 0xC4CD1D, 0xC1CB1F, 0xBFC820, 0xBDC622
];

var borderFrameGradient = [
	0x858485, 0x868686, 0x878788, 0x898889, 0x8A8A8A, 0x8B8C8B, 0x8C8D8C, 0x8E8F8E, 0x8F8F90, 0x909190, 0x939292, 0x939493, 0x959595, 0x969696, 0x989797, 0x999999, 0x9A9B9A, 0x9C9B9C,
	0x9D9D9D, 0x9E9F9E, 0xA0A0A0, 0xA1A0A2, 0xA3A3A2, 0xA4A4A4, 0xA5A5A5, 0xA7A7A6, 0xA8A8A8, 0xA9AAA9, 0xAAABAB, 0xACACAB, 0xAEAEAD, 0xAEAFAE, 0xB1B0B0, 0xB1B2B1, 0xB3B3B3, 0xB5B4B4,
	0xB5B6B5, 0xB7B6B7, 0xB8B8B9, 0xB9BAB9, 0xBBBBBB, 0xBDBCBC, 0xBEBEBE, 0xBFBFC0, 0xC0C1C0, 0xC2C2C2, 0xC3C3C3, 0xC4C5C4, 0xC6C6C5, 0xC7C7C7, 0xC9C8C8, 0xCACACA, 0xCBCBCB, 0xCCCDCD,
	0xCECDCE, 0xCFCFCF, 0xD0D1D1, 0xD2D1D3, 0xD3D3D3, 0xD5D5D5, 0xD7D6D6, 0xD7D7D8, 0xD7D7D8, 0xD6D5D6, 0xD4D4D5, 0xD3D3D2, 0xD1D2D2, 0xD0D1D0, 0xCFCFCF, 0xCECECD, 0xCCCDCC, 0xCBCBCB,
	0xCAC9CA, 0xC8C8C8, 0xC7C7C6, 0xC6C5C6, 0xC4C4C4, 0xC3C3C3, 0xC2C2C1, 0xC0C0C0, 0xBEBFBE, 0xBDBEBE, 0xBCBCBC, 0xBABBBB, 0xB9BAB9, 0xB8B7B8, 0xB6B7B6, 0xB6B5B5, 0xB4B4B4, 0xB2B3B2,
	0xB1B1B1, 0xAFB0AF, 0xAFAEAF, 0xADACAD, 0xACACAB, 0xABAAAA, 0xA8A9A9, 0xA8A7A8, 0xA6A6A7, 0xA5A6A4, 0xA4A3A4, 0xA2A2A2, 0xA1A1A1, 0x9F9FA0, 0x9E9F9E, 0x9C9D9C, 0x9B9C9C, 0x9A9A9A,
	0x999899, 0x979797, 0x969695, 0x959495, 0x939392, 0x919292, 0x919091, 0x908E8F, 0x8D8E8E, 0x8C8D8C, 0x8B8B8B, 0x898A8A, 0x888989, 0x878787, 0x858586, 0x848584
];

var ballGradient = [
	0x5FDA75,
	0x4CAF5E,
	0x398347,
	0x2E6A39,
	0x26582F
];

var octantRefTable = [
	0x0020, 0x1CEA8, 0x1CEAB, 0x1FB82, 0x1CD00, 0x2598, 0x1CD01, 0x1CD02, 
	0x1CD03, 0x1CD04, 0x259D, 0x1CD05, 0x1CD06, 0x1CD07, 0x1CD08, 0x2580, 
	0x1CD09, 0x1CD0A, 0x1CD0B, 0x1CD0C, 0x1FBE6, 0x1CD0D, 0x1CD0E, 0x1CD0F, 
	0x1CD10, 0x1CD11, 0x1CD12, 0x1CD13, 0x1CD14, 0x1CD15, 0x1CD16, 0x1CD17, 
	0x1CD18, 0x1CD19, 0x1CD1A, 0x1CD1B, 0x1CD1C, 0x1CD1D, 0x1CD1E, 0x1CD1F, 
	0x1FBE7, 0x1CD20, 0x1CD21, 0x1CD22, 0x1CD23, 0x1CD24, 0x1CD25, 0x1CD26, 
	0x1CD27, 0x1CD28, 0x1CD29, 0x1CD2A, 0x1CD2B, 0x1CD2C, 0x1CD2D, 0x1CD2E, 
	0x1CD2F, 0x1CD30, 0x1CD31, 0x1CD32, 0x1CD33, 0x1CD34, 0x1CD35, 0x1FB85, 
	0x1CEA3, 0x1CD36, 0x1CD37, 0x1CD38, 0x1CD39, 0x1CD3A, 0x1CD3B, 0x1CD3C, 
	0x1CD3D, 0x1CD3E, 0x1CD3F, 0x1CD40, 0x1CD41, 0x1CD42, 0x1CD43, 0x1CD44, 
	0x2596, 0x1CD45, 0x1CD46, 0x1CD47, 0x1CD48, 0x258C, 0x1CD49, 0x1CD4A, 
	0x1CD4B, 0x1CD4C, 0x259E, 0x1CD4D, 0x1CD4E, 0x1CD4F, 0x1CD50, 0x259B, 
	0x1CD51, 0x1CD52, 0x1CD53, 0x1CD54, 0x1CD55, 0x1CD56, 0x1CD57, 0x1CD58, 
	0x1CD59, 0x1CD5A, 0x1CD5B, 0x1CD5C, 0x1CD5D, 0x1CD5E, 0x1CD5F, 0x1CD60, 
	0x1CD61, 0x1CD62, 0x1CD63, 0x1CD64, 0x1CD65, 0x1CD66, 0x1CD67, 0x1CD68, 
	0x1CD69, 0x1CD6A, 0x1CD6B, 0x1CD6C, 0x1CD6D, 0x1CD6E, 0x1CD6F, 0x1CD70, 
	0x1CEA0, 0x1CD71, 0x1CD72, 0x1CD73, 0x1CD74, 0x1CD75, 0x1CD76, 0x1CD77, 
	0x1CD78, 0x1CD79, 0x1CD7A, 0x1CD7B, 0x1CD7C, 0x1CD7D, 0x1CD7E, 0x1CD7F, 
	0x1CD80, 0x1CD81, 0x1CD82, 0x1CD83, 0x1CD84, 0x1CD85, 0x1CD86, 0x1CD87, 
	0x1CD88, 0x1CD89, 0x1CD8A, 0x1CD8B, 0x1CD8C, 0x1CD8D, 0x1CD8E, 0x1CD8F, 
	0x2597, 0x1CD90, 0x1CD91, 0x1CD92, 0x1CD93, 0x259A, 0x1CD94, 0x1CD95, 
	0x1CD96, 0x1CD97, 0x2590, 0x1CD98, 0x1CD99, 0x1CD9A, 0x1CD9B, 0x259C, 
	0x1CD9C, 0x1CD9D, 0x1CD9E, 0x1CD9F, 0x1CDA0, 0x1CDA1, 0x1CDA2, 0x1CDA3, 
	0x1CDA4, 0x1CDA5, 0x1CDA6, 0x1CDA7, 0x1CDA8, 0x1CDA9, 0x1CDAA, 0x1CDAB, 
	0x2582, 0x1CDAC, 0x1CDAD, 0x1CDAE, 0x1CDAF, 0x1CDB0, 0x1CDB1, 0x1CDB2, 
	0x1CDB3, 0x1CDB4, 0x1CDB5, 0x1CDB6, 0x1CDB7, 0x1CDB8, 0x1CDB9, 0x1CDBA, 
	0x1CDBB, 0x1CDBC, 0x1CDBD, 0x1CDBE, 0x1CDBF, 0x1CDC0, 0x1CDC1, 0x1CDC2, 
	0x1CDC3, 0x1CDC4, 0x1CDC5, 0x1CDC6, 0x1CDC7, 0x1CDC8, 0x1CDC9, 0x1CDCA, 
	0x1CDCB, 0x1CDCC, 0x1CDCD, 0x1CDCE, 0x1CDCF, 0x1CDD0, 0x1CDD1, 0x1CDD2, 
	0x1CDD3, 0x1CDD4, 0x1CDD5, 0x1CDD6, 0x1CDD7, 0x1CDD8, 0x1CDD9, 0x1CDDA, 
	0x2584, 0x1CDDB, 0x1CDDC, 0x1CDDD, 0x1CDDE, 0x2599, 0x1CDDF, 0x1CDE0, 
	0x1CDE1, 0x1CDE2, 0x259F, 0x1CDE3, 0x2586, 0x1CDE4, 0x1CDE5, 0x2588
];

function octantApplyDot(chr, x, y) {
	var chrCode = chr.codePointAt();
	var idx = octantRefTable.indexOf(chrCode);
	if(idx == -1) return chr;
	var pos = y * 2 + x;
	pos = 1 << pos;
	return String.fromCodePoint(octantRefTable[idx | pos]);
}


var ref_textGrid = new Array(dimensions.w * dimensions.h).fill(null);
var ref_textGridColor = new Array(dimensions.w * dimensions.h).fill(null);
var ref_textGridBgColor = new Array(dimensions.w * dimensions.h).fill(null);

var textGrid = new Array(dimensions.w * dimensions.h).fill(" ");
var textGridColor = new Array(dimensions.w * dimensions.h).fill(0);
var textGridBgColor = new Array(dimensions.w * dimensions.h).fill(-1);



function setCharAt(x, y, char, f_bold, f_italic, f_under, f_strike) {
	if(x < 0 || y < 0) return;
	if(x >= dimensions.w || y >= dimensions.h) return;
	var idx = y * dimensions.w + x;
	textGrid[idx] = setCharTextDecorations(char, f_bold, f_italic, f_under, f_strike);
	hasUpdated = true;
}

function getCharAt(x, y) {
	if(x < 0 || y < 0) return " ";
	if(x >= dimensions.w || y >= dimensions.h) return " ";
	var idx = y * dimensions.w + x;
	return clearCharTextDecorations(textGrid[idx]);
}

function setColorAt(x, y, color) {
	if(x < 0 || y < 0) return;
	if(x >= dimensions.w || y >= dimensions.h) return;
	var idx = y * dimensions.w + x;
	textGridColor[idx] = color;
	hasUpdated = true;
}

function setBgColorAt(x, y, bgColor) {
	if(x < 0 || y < 0) return;
	if(x >= dimensions.w || y >= dimensions.h) return;
	var idx = y * dimensions.w + x;
	textGridBgColor[idx] = bgColor;
	hasUpdated = true;
}

function setOctantAt(ax, ay, color) {
	var x = Math.floor(ax / 2);
	var y = Math.floor(ay / 4);
	if(x < 0 || y < 0 || x >= dimensions.w || y >= dimensions.h) return;
	setCharAt(x, y, octantApplyDot(getCharAt(x, y), ax % 2, ay % 4));
	setColorAt(x, y, color);
}

function drawOctantLine(x0, y0, x1, y1, color) {
	x0 = Math.floor(x0);
	y0 = Math.floor(y0);
	x1 = Math.floor(x1);
	y1 = Math.floor(y1);
	var dx = Math.abs(x1 - x0);
	var dy = Math.abs(y1 - y0);
	var sx = (x0 < x1) ? 1 : -1;
	var sy = (y0 < y1) ? 1 : -1;
	var err = dx - dy;
	for(var i = 0; i < 5000; i++) {
		setOctantAt(x0, y0, color);
		if((x0 == x1) && (y0 == y1)) break;
		var e2 = 2 * err;
		if(e2 > -dy) {
			err -= dy;
			x0 += sx;
		}
		if(e2 < dx) {
			err += dx;
			y0 += sy;
		}
	}
}

function _drawCircle(xc, yc, x, y, color) {
	setOctantAt(xc + x, yc + y, color); 
	setOctantAt(xc - x, yc + y, color); 
	setOctantAt(xc + x, yc - y, color); 
	setOctantAt(xc - x, yc - y, color); 
	setOctantAt(xc + y, yc + x, color); 
	setOctantAt(xc - y, yc + x, color); 
	setOctantAt(xc + y, yc - x, color); 
	setOctantAt(xc - y, yc - x, color); 
}

function drawOctantCircle(xc, yc, r, color) {
	var x = 0, y = r;
	var d = 3 - 2 * r;
	_drawCircle(xc, yc, x, y, color);
	while(y >= x) {
		x++;
		if(d > 0) {
			y--;
			d = d + 4 * (x - y) + 10;
		} else {
			d = d + 4 * x + 6;
		}
		_drawCircle(xc, yc, x, y, color);
	}
}

function writeCharToXY(char, color, px, py, bgColor) {
	if(px < 0 || py < 0) return;
	if(px >= dimensions.w || py >= dimensions.h) return;
	var idx = py * dimensions.w + px;
	setCharAt(px, py, char);
	setColorAt(px, py, color);
	setBgColorAt(px, py, bgColor);
	hasUpdated = true;
}

function pasteIn(ipx, ipy, str, color, f_bold, f_italic, f_under, f_strike, bgColor) {
	str = advancedSplit(str);
	var x = ipx;
	var y = ipy;
	for(var i = 0; i < str.length; i++) {
		if(str[i] == "\n") {
			x = ipx;
			y++;
			continue;
		}
		setCharAt(x, y, str[i], f_bold, f_italic, f_under, f_strike);
		setColorAt(x, y, color);
		if(bgColor != null) setBgColorAt(x, y, bgColor);
		x++;
	}
}


function clearRectangle(px, py, width, height) {
	for(var y = 0; y < height; y++) {
		for(var x = 0; x < width; x++) {
			var posX = px + x;
			var posY = py + y;
			setCharAt(posX, posY, " ");
			setColorAt(posX, posY, 0);
			setBgColorAt(posX, posY, -1);
		}
	}
}

function clearGrid() {
	clearRectangle(0, 0, dimensions.w, dimensions.h);
}


function convertToDate(epoch, offset) {
	var months = [
		"Jan", "Feb", "Mar",
		"Apr", "May", "Jun",
		"Jul", "Aug", "Sep",
		"Oct", "Nov", "Dec"
	];
	var str = "";
	epoch += offset * minuteLen;
	var date = new Date(epoch);
	var month = date.getUTCMonth();
	var day = date.getUTCDate();
	var year = date.getUTCFullYear();
	var hour = date.getUTCHours();
	var minute = date.getUTCMinutes();
	var second = date.getUTCSeconds();
	//str += year + " " + months[month] + " " + day + " ";
	var per = "AM";
	if(hour >= 12) {
		per = "PM";
	}
	if(hour > 12) {
		hour = hour - 12;
	}
	if(hour == 0) {
		hour = 12;
	}
	str += hour.toString().padStart(2, 0) + ":" + minute.toString().padStart(2, 0) + " " + per;
	//str += months[month] + " " + day + ", " + year + " " + hour + ":" + minute.toString().padStart(2, 0) + ":" + second.toString().padStart(2, 0) + " " + per;
	return str;
}

function coldBootGetTz() {
	var now = getDate();
	var minutesLeft = Math.floor((epochTime - getDate()) / minuteLen);
	for(var i = 0; i < tzOrder.length; i++) {
		var tz = tzOrder[i];
		if(minutesLeft >= tz) {
			return tz;
		}
	}
	return 12345;
}

function timeLeft(offset) {
	var epochOff = getDate() + minuteLen * offset;
	var rem = epochTime - epochOff;
	if(rem < 0) return [0, 0, 0];
	var hr = Math.floor(rem / (1000 * 60 * 60));
	var mn = Math.floor(rem / (1000 * 60)) % (60);
	var sc = Math.floor(rem / (1000)) % 60;
	return [hr, mn, sc];
}

function getStrTimeLeft(offset) {
	var tl = timeLeft(offset);
	return tl[0].toString().padStart(2, 0) + ":" + tl[1].toString().padStart(2, 0) + ":" + tl[2].toString().padStart(2, 0);
}

function timeLeftFrac(offset) {
	var epochOff = getDate() + minuteLen * offset;
	var rem = epochTime - epochOff;
	if(rem < 0) rem = 0;
	return rem / (hourLen); // still using hour
}

function rangeRandom(start, end) {
    var range = end - start + 1;
    return Math.floor(Math.random() * range + start);
}

function int_to_rgb(value) {
	var r = (value >> 16) & 255;
	var g = (value >> 8) & 255;
	var b = value & 255;
	return [r, g, b];
}

function int_to_hexcode(value) {
	return "#" + value.toString(16).padStart(6, 0);
}

function rgb_to_int(r, g, b) {
	return b | g << 8 | r << 16;
}




var textDecorationOffset = 0x20F0;

function getCharTextDecorations(char) {
	var code = char.charCodeAt(char.length - 1);
	code -= textDecorationOffset;
	if(code <= 0 || code > 16) return null;
	return {
		bold: code >> 3 & 1,
		italic: code >> 2 & 1,
		under: code >> 1 & 1,
		strike: code & 1
	};
}
function clearCharTextDecorations(char) {
	var len = char.length;
	var decoCount = 0;
	for(var i = 0; i < len; i++) {
		var pos = len - 1 - i;
		var code = char.charCodeAt(pos);
		if(code >= textDecorationOffset + 1 && code <= textDecorationOffset + 16) {
			decoCount++;
		} else {
			break;
		}
	}
	if(decoCount > 0) {
		return char.slice(0, len - decoCount);
	}
	return char;
}
function setCharTextDecorations(char, bold, italic, under, strike) {
	var bitMap = bold << 3 | italic << 2 | under << 1 | strike;
	char = clearCharTextDecorations(char);
	if(!bitMap) return char;
	return char + String.fromCharCode(textDecorationOffset + bitMap);
}


function genEdits() {
	var edits = [];
	for(var i = 0; i < textGrid.length; i++) {
		var chr = textGrid[i];
		var col = textGridColor[i];
		var bcol = textGridBgColor[i];
		var x = i % dimensions.w;
		var y = Math.floor(i / dimensions.w);
		if(textGrid[i] != ref_textGrid[i] || textGridColor[i] != ref_textGridColor[i] || textGridBgColor[i] != ref_textGridBgColor[i]) {
			var ax = x + position.x;
			var ay = y + position.y;
			
			var tileX = Math.floor(ax / 16);
			var tileY = Math.floor(ay / 8);
			var charX = ax - Math.floor(ax / 16) * 16;
			var charY = ay - Math.floor(ay / 8) * 8;
			
			var edit = [tileY, tileX, charY, charX, 0, chr, 0, col, bcol];
			edits.push(edit);
		}
		ref_textGrid[i] = textGrid[i];
		ref_textGridColor[i] = textGridColor[i];
		ref_textGridBgColor[i] = textGridBgColor[i];
	}
	return edits;
}


function setTexturedRectangle(px, py, width, height, array, texStartX) {
	for(var y = 0; y < height; y++) {
		for(var x = 0; x < width; x++) {
			var posX = px + x;
			var posY = py + y;
			var color = array[posX - texStartX];
			setCharAt(posX, posY, chars.block);
			setColorAt(posX, posY, color);
		}
	}
}

function setBgRectangle(px, py, width, height, bgColor) {
	for(var y = 0; y < height; y++) {
		for(var x = 0; x < width; x++) {
			var posX = px + x;
			var posY = py + y;
			setBgColorAt(posX, posY, bgColor);
		}
	}
}




function pasteArt(px, py, data, transparent, colorKey, colorReplace, bgColorKey, bgColorReplace) {
	for(var i = 0; i < data.length; i++) {
		var cell = data[i];
		var ax = cell[0];
		var ay = cell[1];
		var char = cell[2];
		var color = cell[3];
		var bgColor = cell[4];
		
		var decoStat = getCharTextDecorations(char);
		
		if(colorKey != void 0 && colorKey == color) {
			color = colorReplace;
		}
		if(bgColorKey != void 0 && bgColorKey == bgColor) {
			bgColor = bgColorReplace;
		}
		if(transparent && bgColor == -1) {
			if(char.trim().length == 0) {
				continue;
			}
		}
		
		if(decoStat) {
			setCharAt(px + ax, py + ay, char, decoStat.bold, decoStat.italic, decoStat.under, decoStat.strike);
		} else {
			setCharAt(px + ax, py + ay, char);
		}
		setColorAt(px + ax, py + ay, color);
		setBgColorAt(px + ax, py + ay, bgColor);
	}
}

function highlightTz(off) {
	var coords = tzCoords[off];
	if(!coords) return;
	for(var i = 0; i < coords.length; i++) {
		var pos = coords[i];
		var x = pos[0];
		var y = pos[1];
		setColorAt(mapStart[0] + x, mapStart[1] + y, color_landlight);
		setBgColorAt(mapStart[0] + x, mapStart[1] + y, color_waterlight);
	}
}

function gradientRectangle(px, py, ex, ey) {
	for(var x = px; x <= ex; x++) {
		var frac = (x - px) / (ex - px);
		
		var initHSL = tzHSLVals[currentTz] || [0, 0, 0];
		var hColor = hsl_to_rgb(initHSL[0], initHSL[1] * 1.2, Math.sin(frac * Math.PI) / 5 + 0.1);
		
		var colColor = rgb_to_int(...hColor);
		
		for(var y = py; y <= ey; y++) {
			var chr = getCharAt(x, y);
			if(chr == " ") continue;
			setColorAt(x, y, colColor);
		}
	}
}



var currentTz = coldBootGetTz();
console.log("Starting TZ: " + currentTz);

var hasUpdated = true;

var mapStart = [8, 4]; // borders not included
var poleStart = [63, 12];
var ballStart = [60, 12];
var poleBaseStart = [60, 33];
var poleBaseNumStart = [63, 33];
var timePanelStart = [52, 3];
var ballPanelStart = [60, 11];
var scrollerStart = [6, 18];
var tzListStart = [6, 20];
var piePos = [100, 10];

var poleHeight = 21;
var poleBaseWidth = 8;
var polePositions = poleHeight - ballTemplate.length;
var scrollerWidth = 46;

var timePanelSize = [24, 8];
var ballPanelSize = [8, 22];
var mapSize = [42, 12];

var titleStart = [Math.floor(128 - title.length) / 2, 1];

var color_water = 0x1D46E9;
var color_land = 0x2C8827;
var color_waterlight = 0x1DA5E9;
var color_landlight = 0x28FF2B;
var color_pole = 0xC3C3C3;
var color_polebase = 0x838383;



function magicPaste(x, y, data, color, bgColor, grad) {
	for(var i = 0; i < data.length; i++) {
		var row = data[i];
		if(grad) {
			color = grad[i];
		}
		pasteIn(x, y + i, row, color, false, false, false, false, bgColor);
	}
}









var rem = timeLeft(currentTz);
var fallMode = 0;
var fireworksMode = false;

var readyNext = false;

clearGrid();

function makeFrame() {
	setTexturedRectangle(2, 1, 124, 1, borderFrameGradient, 2); // top
	setTexturedRectangle(2, 38, 124, 1, borderFrameGradient, 2); // bottom
	setTexturedRectangle(2, 1, 2, 38, borderFrameGradient, 2); // left
	setTexturedRectangle(124, 1, 2, 38, borderFrameGradient, 2); // right
	setTexturedRectangle(54, 0, 20, 1, borderFrameGradient, 2); // title-top
	setTexturedRectangle(54, 2, 20, 1, borderFrameGradient, 2); // title-bottom
	pasteIn(titleStart[0] - 1, titleStart[1], " " + title + " ", 0x000000, true, false, false, false);
}

function makeMap() {
	setTexturedRectangle(mapStart[0] - 2, mapStart[1] - 1, mapSize[0] + 4, mapSize[1] + 2, mapFrameGradient, mapStart[0] - 2);
	pasteArt(mapStart[0], mapStart[1], artData.worldMap, false, 0xFF00FF, color_land, 0x00FF00, color_water);
	highlightTz(currentTz);
}

function printNumber(str, hslValue) {
	var coords = [
		[90, 18],
		[101, 18]
	];
	for(var x = 0; x < str.length; x++) {
		var dig = parseInt(str[x]);
		var img = numset.slice(6 * dig, 6 * dig + 6);
		magicPaste(coords[x][0], coords[x][1], img, 0, -1);
	}
}

function makeBallDrop(customFrac) {
	var ballPos = 0;
	var isFinal = false;
	if(rem[0] == 0 && rem[1] == 0 && !fireworksMode) {
		ballPos = Math.floor((60 - rem[2]) / 60 * polePositions);
		isFinal = true;
		fallMode = 1;
	} else if(fireworksMode) {
		ballPos = polePositions;
	}
	
	if(customFrac != void 0) ballPos = Math.floor(polePositions * customFrac);
	
	clearRectangle(ballPanelStart[0], ballPanelStart[1], ballPanelSize[0], ballPanelSize[1]);
	setBgRectangle(poleStart[0], poleStart[1], 2, poleHeight, color_pole);
	setBgRectangle(poleBaseStart[0], poleBaseStart[1], poleBaseWidth, 1, color_polebase);
	
	var initHSL = tzHSLVals[currentTz] || [0, 0, 0];
	var mul = [1.5, 1.2, 1, 0.7, 0.5];
	for(var i = 0; i < ballTemplate.length; i++) {
		
		var rowColor = hsl_to_rgb(initHSL[0], initHSL[1], initHSL[2] * mul[i]);
		
		pasteIn(ballStart[0], ballStart[1] + i + ballPos, ballTemplate[i], rgb_to_int(...rowColor), false, false, false, false, null);
	}
	
	if(isFinal) {
		var str_tl = rem[2].toString().padStart(2, 0);
		pasteIn(Math.floor((dimensions.w - str_tl.length) / 2), poleStart[1] + poleHeight, str_tl, 0xFFFFFF, true, false, false, false);
		printNumber(str_tl);
		gradientRectangle(90, 18, 90 + 19, 18 + 5);
	}
}

function makeMiniTimeDisplay() {
	clearRectangle(timePanelStart[0], timePanelStart[1], timePanelSize[0], timePanelSize[1]);
	var str_localtime = "Local time:";
	var str_timerem = "Time remaining:";
	var str_numlocaltime = convertToDate(getDate(), currentTz);
	var str_numtimerem = getStrTimeLeft(currentTz);
	//var currentTzAbbr = tzAbbr[currentTz];
	var gmt_str = "UTC";
	if(currentTz < 0) {
		gmt_str += "-";
	} else {
		gmt_str += "+";
	}
	var tempCurrentTz = Math.abs(currentTz);
	
	var tzHour = Math.floor(tempCurrentTz / 60);
	var tzMin = tempCurrentTz % 60;
	gmt_str += tzHour.toString().padStart(2, 0);
	if(tzMin > 0) {
		gmt_str += ":" + tzMin.toString().padStart(2, 0);
	}
	
	var str_tzabbr = gmt_str; // + " (" + currentTzAbbr[Math.floor(getDate() / (1000 * 10)) % currentTzAbbr.length] + ")";
	pasteIn(Math.floor((dimensions.w - str_localtime.length) / 2), 4, str_localtime, 0x000000, true, false, false, false);
	pasteIn(Math.floor((dimensions.w - str_numlocaltime.length) / 2), 5, str_numlocaltime, 0x000000, false, false, false, false);
	pasteIn(Math.floor((dimensions.w - str_tzabbr.length) / 2), 6, str_tzabbr, 0x000000, false, false, false, false);

	pasteIn(Math.floor((dimensions.w - str_timerem.length) / 2), 8, str_timerem, 0x000000, true, false, false, false);
	pasteIn(Math.floor((dimensions.w - str_numtimerem.length) / 2), 9, str_numtimerem, 0x000000, false, false, false, false);
	
	var initHSL = tzHSLVals[currentTz] || [0, 0, 0];
	var rowColor = hsl_to_rgb(initHSL[0], initHSL[1] * 1.2, initHSL[2] * 1.7);
	
	pasteIn(Math.floor((dimensions.w - str_yr.length) / 2), poleStart[1] - 1, str_yr, rgb_to_int(...rowColor), true, true, false, false);
}

function renderScrollingTimezones() {
	var currentTzAbbr = tzAbbr[currentTz];
	if(!currentTzAbbr) currentTzAbbr = [];
	//console.log(currentTz)
	var list = currentTzAbbr.join("...") + "...";
	var len = scrollerWidth - 2;
	var str = "[";
	for(var i = 0; i < len; i++) {
		var off = Math.floor(Math.floor(getDate() / (1000 / 15)));
		str += list[(off + i) % list.length];
	}
	str += "]";
	pasteIn(scrollerStart[0], scrollerStart[1], str, 0, false, false, false, false, member_bg_color);
}

function renderTimezoneList() {
	pasteIn(tzListStart[0], tzListStart[1], "Time zones:", 0xFFFFFF, true, false, false, false);
	var list = tzAbbr[currentTz];
	if(!list) list = [];
	
	var tmpList = [];
	for(var i = 0; i < list.length; i++) {
		var abbr = list[i];
		var name = tzName[abbr];
		if(!name) continue;
		for(var x = 0; x < name.length; x++) {
			if(name[x][1] != currentTz) continue;
			tmpList.push([abbr, name[x][0]]);
		}
	}
	
	for(var i = 0; i < tmpList.length; i++) {
		var data = tmpList[i];
		var tzStr = "● " + data[0];
		pasteIn(tzListStart[0] + 1, tzListStart[1] + 1 + i, tzStr, 0xFFFFFF, true);
		pasteIn(tzListStart[0] + 1 + tzStr.length, tzListStart[1] + 1 + i, "; " + data[1], 0xFFFFFF);
	}
}


function setupFrame() {
	makeFrame();
	makeMap();
	makeBallDrop();
	makeMiniTimeDisplay();
}


var hnyflash = null;
var cooldn = null;
function makeHnyFlash() {
	hnyflash = setInterval(function() {
		var pos = Math.floor(getDate() / 500) % 2;
		var color = [0xFFFFFF, 0xFF0000][pos];
		var str = "Happy New Year!";
		pasteIn(Math.floor((dimensions.w - str.length) / 2), poleStart[1] + poleHeight + 1, str, color, true, true, true, false);
	}, 500);
}
function makeCooldn() {
	cooldn = setTimeout(function() {
		fallMode = 2;
		cleanScreenAnimated();
	}, 1000 * 60 * 0.5);
}

function cleanScreenAnimated() {
	clearInterval(hnyflash);
	var width = Math.floor(dimensions.w / 3);
	var x = 0;
	var clearScnIntv = setInterval(function() {
		clearRectangle(x * 3 + Math.floor(dimensions.w / 2), 0, 3, dimensions.h);
		clearRectangle(Math.floor(dimensions.w / 2) - x * 3, 0, 3, dimensions.h);
		x++;
		if(x > width / 2) {
			clearInterval(clearScnIntv);
			fallMode = 3;
			raiseBall();
		}
		makeFrame();
		makeMap();
		makeBallDrop();
	}, 1000 / 8);
}

function raiseBall() {
	var raiseDuration = 4000;
	var raiseStart = Date.now();
	var raiseIntv = setInterval(function() {
		var pos = (Date.now() - raiseStart) / raiseDuration;
		if(pos > 1) pos = 1;
		makeBallDrop(1 - pos);
		if(pos >= 1) {
			clearInterval(raiseIntv);
			//console.log("ball raised");
			setTimeout(function() {
				readyNext = true;
				fallMode = 0;
				currentTz = coldBootGetTz();
			}, 500);
		}
	}, 1000 / 8);
}

setInterval(function() {
	if(!fireworksMode) {
		renderScrollingTimezones();
	}
}, 1000 / 15);

function renderTimePie() {
	clearRectangle(85, 3, 32, 14);
	
	var ratio = 1 - timeLeftFrac(currentTz);
	if(ratio > 0.998) ratio = 1;
	
	var ox = piePos[0] * 2;
	var oy = piePos[1] * 4;
	
	var maxAngle = Math.PI * 2 * ratio - Math.PI;

	var radius = 25;

	function trig(x, y) {
		var val = Math.atan2(x, y);
		return [Math.sin(val), Math.cos(val)];
	}
	
	for(var y = 0; y < radius * 2; y++) {
		for(var x = 0; x < radius * 2; x++) {
			var ax = x - radius;
			var ay = y - radius;
			if(ax * ax + ay * ay <= radius * radius) {
				var angle = Math.atan2(ax, ay);
				if(angle > maxAngle) continue;
				setOctantAt(ox + ax, oy + ay, 0x00FF00);
			}
		}
	}
	
	drawOctantCircle(ox, oy, radius, 0x00FF00);
}

setInterval(function() {
	rem = timeLeft(currentTz);
	if(readyNext && fireworksMode) {
		readyNext = false;
		fireworksMode = false;
		clearInterval(hnyflash);
		clearGrid();
		makeFrame();
		makeMap();
		makeMiniTimeDisplay();
	}
	if(!fireworksMode) {
		currentTz = coldBootGetTz();
		renderTimePie();
		gradientRectangle(87 - 2, 3, 112 + 2, 16);
		renderTimezoneList();
		makeBallDrop();
		makeMiniTimeDisplay();
	}
	if(!fireworksMode && fallMode > 0 && rem[2] == 0) {
		fireworksMode = true;
		fallMode = 0;
		readyNext = false;
		makeHnyFlash();
		currentTz = coldBootGetTz();
		makeCooldn();
		
		var fwCount = 0;
		var fwMax = 12;
		var fwAdd = setInterval(function() {
			var x = rangeRandom(9, 118);
			var y = rangeRandom(5, 31);
			explodeAtXY(x, y);
			fwCount++;
			if(fwCount >= fwMax) {
				clearInterval(fwAdd);
			}
		}, 1000);
	}
}, 1000);

function explodeAtXY(posX, posY) {
	var fwcolors = [
		0xCE2029,
		0xFFFCAF,
		0xFFE17C,
		0xFF664B,
		0x903843,
		0x03471C,
		0x4B894B,
		0xE9DC84,
		0xD5C367
	];

	function random(a, b) {
		return Math.random() * (b - a) + a;
	}
	
	var fwcolor = fwcolors[Math.floor(Math.random() * fwcolors.length)];
	var maxSize = 0;
		
	var branchCount = 15;
	var editBatches = new Array(branchCount);
	for(var x = 0; x < editBatches.length; x++) {
		editBatches[x] = {};
	}
	
	for(var b = 0; b < branchCount; b++) {
		var angle = Math.random() * Math.PI * 2;
		var velocityX = Math.sin(angle);
		var velocityY = Math.cos(angle);
		
		var fX = posX;
		var fY = posY;
		
		for(var i = 0; i < 25; i++) {
			var x = Math.floor(fX);
			var y = Math.floor(fY);
			var bv = Math.floor((i / 25) * 4);
			editBatches[b][x + "," + y] = ["\u2588\u2593\u2592\u2591"[bv], fwcolor];
			
			fX += velocityX;
			fY -= velocityY;
			
			velocityY -= 0.05;
		}
	}
	
	for(var i = 0; i < editBatches.length; i++) {
		var batch = editBatches[i];
		var list = [];
		for(var w in batch) {
			var pos = w.split(",");
			var x = parseInt(pos[0]);
			var y = parseInt(pos[1]);
			var char = batch[w][0];
			var color = batch[w][1];
			list.push([x, y, char, color]);
		}
		editBatches[i] = list;
		var len = list.length;
		if(len > maxSize) maxSize = len;
	}
	
	var fwp = 0;
	var fwi = setInterval(function() {
		for(var w = 0; w < editBatches.length; w++) {
			var batch = editBatches[w];
			if(fwp >= batch.length) continue;
			var spark = batch[fwp];
			var px = spark[0];
			var py = spark[1];
			var char = spark[2];
			var color = spark[3];
			writeCharToXY(char, color, px, py);
		}
		fwp++;
		if(fwp >= maxSize) {
			clearInterval(fwi);
		}
	}, 1000 / 17);
}


var timerHasStarted = false;
function beginTimer() {
	setInterval(function() {
		var ed = genEdits();
		var editMax = 512;
		var editGroup = Math.ceil(ed.length / editMax);
		for(var i = 0; i < editGroup; i++) {
			var data = {
				kind: "write",
				edits: ed.slice(i * editMax, i * editMax + editMax)
			};
			try {
				sock.send(JSON.stringify(data));
			} catch(e) {
				console.log(e);
			}
		}
	}, 1000 / 8);
}



var sock;
async function mksock() {
	console.log("Getting token...");
	var tokenData = await owotAuth.getToken();
	console.log("Token retrieved!");
	
	sock = new WebSocket(socketPath, {
		headers: {
			Cookie: "token=" + tokenData
		}
	});
	sock.onopen = function() {
		console.log("Sock open");
		
		try {
			sock.send(JSON.stringify({
				kind: "config",
				updates: false
			}));
		} catch(e) {
			console.log(e)
		}
		
		
		if(!timerHasStarted) {
			timerHasStarted = true;
			setupFrame();
			beginTimer();
		}
		
		
		
		
	}
	sock.onclose = function() {
		console.log("Sock close");
		setTimeout(mksock, 2000);
	}
	sock.onerror = function() {
		// error
	}
	sock.onmessage = function(msg) {
		// message
	}
}


async function main() {
	console.log("Starting service...");
	
	mksock();
}

main();