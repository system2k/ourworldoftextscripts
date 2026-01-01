var coordiv = document.createElement("div");
coordiv.style.backgroundColor = "#bbd1ff";
coordiv.style.position = "absolute";
coordiv.style.width = "180px";
coordiv.style.height = "90px";
coordiv.style.top = "27px";
coordiv.style.right = "120px";
coordiv.style.paddingTop = "4px";
coordiv.style.paddingLeft = "4px";
var coordtext = document.createElement("span");
coordiv.appendChild(coordtext);
document.body.appendChild(coordiv);
function coordupdate() {
	var pos = currentPosition;
	var str = "";
	str += "Char: [" + (pos[0] * 16 + pos[2] - -64) + ", " + (pos[1] * 8 + pos[3] - -20) + "]";
	coordtext.innerText = str;
}
document.onmousemove = coordupdate;