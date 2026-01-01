var fs = require("fs");
var querystring = require("querystring");
var https = require("https");
var path = require("path");


var credPath = path.resolve(__dirname, "./auth.txt");
var keyPath = path.resolve(__dirname, "./tok.txt");

var authData = JSON.parse(fs.readFileSync(credPath).toString("utf8"));


function parseCookie(input) {
	if(!input) input = "";
	var out = {};

	var mode = 0; // 0 = key, 1 = value
	var buffer_k = ""; // key
	var buffer_v = ""; // value

	for(var i = 0; i < input.length; i++) {
		var chr = input.charAt(i);

		var sSkip = false; // jump over char buffer

		// check for value assignments
		if(chr == "=" && mode == 0) {
			mode = 1;
			sSkip = true;
		}

		// char buffer
		if(chr != ";" && !sSkip) {
			if(mode == 0) {
				buffer_k += chr;
			}
			if(mode == 1) {
				buffer_v += chr;
			}
		}

		// check ending of each key/value
		if(chr == ";" || i == input.length - 1) {
			mode = 0;

			// trim whitespaces from beginning and end
			buffer_k = buffer_k.trim();
			buffer_v = buffer_v.trim();

			var valid = true;

			// ignore empty sets
			if(buffer_k == "" && buffer_v == "") {
				valid = false;
			}

			if(valid) {
				// strip quotes (if any)
				if(buffer_k.charAt(0) == "\"" && buffer_k.charAt(buffer_k.length - 1) == "\"") buffer_k = buffer_k.slice(1, -1);
				if(buffer_v.charAt(0) == "\"" && buffer_v.charAt(buffer_v.length - 1) == "\"") buffer_v = buffer_v.slice(1, -1);

				// invalid escape sequences can cause errors
				try {
					buffer_k = decodeURIComponent(buffer_k);
				} catch(e){}
				try {
					buffer_v = decodeURIComponent(buffer_v);
				} catch(e){}

				// no overrides from sets with the same key
				if(!(buffer_k in out)) out[buffer_k] = buffer_v;
			}

			buffer_k = "";
			buffer_v = "";
		}
	}

	return out;
}

function doLogin(auth) {
	return new Promise(function(resolve) {
		var loginData = querystring.stringify({
			service: "owot",
			loginname: auth.user,
			pass: auth.pass
		});

		var head = {
			"Content-Type": "application/x-www-form-urlencoded",
			"Content-Length": Buffer.byteLength(loginData),
			"User-Agent": "OWOT Gateway Login System/1.0",
			"Accept-Language": "en,en-US;q=0.9",
			//"Host": "uvias.com"
		};
		var finalized = false;

		var lreq = https.request({
			hostname: "uvias.com",
			port: 443,
			path: "/api/auth/uvias",
			headers: head,
			method: "POST"
		}, function(res) {
			if(finalized) return;
			finalized = true;
			var cookie = res.headers["set-cookie"];
			if(!cookie) {
				return resolve(null);
			} else {
				for(var c = 0; c < cookie.length; c++) {
					var p = parseCookie(cookie[c]);
					if(p.uviastoken) {
						return resolve(p.uviastoken);
					}
				}
			}
			resolve(null);
		});
		lreq.on("error", function() {
			if(finalized) return;
			finalized = true;
			resolve("NET");
		});

		lreq.write(loginData);
		lreq.end();
	});
}

function testLogin(token) {
	return new Promise(function(resolve) {
		var head = {
			"Cookie": "token=" + token
		};
		var finalized = false;
		console.log("Sending request for login test...");
		var lreq = https.request({
			hostname: "ourworldoftext.com",
			port: 443,
			path: "/accounts/member_autocomplete/",
			headers: head,
			method: "GET"
		}, function(res) {
			console.log("Received request response while testing login key");
			if(finalized) return;
			finalized = true;
			var stat = res.statusCode;
			console.log("Status while testing login key: " + stat);
			if(stat == 403) { // login failed
				resolve(false);
			} else { // login succeeded/etc
				resolve(true);
			}
		});
		lreq.on("error", function() {
			console.log("Error thrown while testing login");
			if(finalized) return;
			finalized = true;
			resolve("NET");
		});
		lreq.end();
	});
}

function wait(ms) {
	return new Promise(function(res) {
		setTimeout(res, ms);
	});
}

async function validateLogin() {
	var isAuth = false;
	var tokenData = null;
	if(fs.existsSync(keyPath)) {
		tokenData = fs.readFileSync(keyPath).toString("utf8");
	}
	if(tokenData) {
		console.log("Testing login key...");
		isAuth = await testLogin(tokenData);
		console.log("Login key tested");
	} else {
		console.log("No token found. Logging in...");
	}
	if(isAuth == "NET") return "NET";
	if(!isAuth) {
		var newToken = await doLogin(authData);
		if(!newToken) {
			throw "Login failed";
		}
		if(newToken == "NET") return "NET";
		tokenData = newToken;
		fs.writeFileSync(keyPath, tokenData);
		console.log("Login success! Written token to file.");
	} else {
		console.log("Token valid.");
	}
	return tokenData;
}


async function tokenValidationLoop() {
	var stat = await validateLogin();
	if(stat == "NET") {
		console.log("Network error. Trying again...");
		while(true) {
			await wait(1000 * 10);
			stat = await validateLogin();
			if(stat != "NET") {
				break;
			}
		}
	}
	return stat;
}

module.exports = {
	getToken: tokenValidationLoop
};
