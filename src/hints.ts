import { Direction, Directions } from "./angle.js";
import { cell_size, portal_pad, portal_size, planet_size, portals_ext } from "./draw.js";
import { flightplan } from "./flightplan.js";
import { mode, redraw } from "./index.js";
import { Planet } from "./planets.js";
import { Star } from "./stars.js";
import { player_star } from "./universe.js";

export var shown_star: Star;

export function set_shown_star(x: Star) { shown_star = x };

// var grid=[];
var hintTarget: HTMLElement;
var visibleStar: Star;

export function setupHints(star: Star, canvas: HTMLCanvasElement, hintTargetObj: HTMLElement) {
	visibleStar = star;
	canvas.onmousemove = hint;
	hintTarget = hintTargetObj;
	canvas.onmouseleave = function () { hintTarget.innerText = 'Hover an object on the map to see what it is' };
	canvas.onclick = click;
}

function hintText(obj: Direction | Star | Planet): string[] {
	if (obj instanceof Direction) {
		if (!obj.target) return ['Portal to unknown' + (mode == 'test' ? ' at' + obj.value : '')];
		var ret = ['Portal to ' + hintText(obj.target) + (mode == 'test' ? ' at' + obj.value : '')];
		if (mode == 'flyi') return ret;
		if (shown_star == player_star) {
			if (Math.abs(obj.x - flightplan.steps[0].x) < 0.001 &&
				Math.abs(obj.y - flightplan.steps[0].y) < 0.001) {
				ret.push('(you are here)');
			} else {
				var reason = flightplan.cantJumpTo(obj.target, obj);
				if (reason) ret.push("You can't travel there: " + reason);
				else ret.push("You can travel there");
			}
		} else {
			if (obj.target == player_star) ret = ret.concat(['(you are there)', 'Click to return']);
			else if (obj.target.visited) ret.push("(you've been there before)");
		}
		if (obj.target != player_star) {
			ret.push('Click to explore');
		}
		return ret;
	} else if (obj instanceof Planet) {
		var ret = [obj.name + ' planet'];
		if (obj.buys) ret.push('Buys: ' + obj.buys);
		if (obj.sells) ret.push('Sells: ' + obj.sells);
		if (shown_star == player_star && mode != 'flyi') {
			var reason = flightplan.cantTravelTo(obj);
			if (flightplan.lastStep.planet == obj) {
				ret.push('Click to remove it from the flight plan');
			} else if (reason) {
				ret.push(`Can't travel there: ${reason}`);
			} else {
				ret.push('Click to add it to the flight plan');
			}
		}
		return ret;
	} else if (obj instanceof Star) {
		return [obj.name + ' star'];
	}
	return ['Unknown object'];
}

function objAt(x: number, y: number, event: MouseEvent): Star | Planet | Direction | undefined {
	var cell_x = Math.floor(x / cell_size - portal_pad);
	var cell_y = Math.floor(y / cell_size - portal_pad);
	// console.log(cell_x,cell_y);
	if (cell_x < 0 || cell_x >= visibleStar.size ||
		cell_y < 0 || cell_y >= visibleStar.size) {
		// in portal area
		var radius = portal_size / cell_size;
		for (var neighbour of visibleStar.neighbours) {
			var dist = Math.hypot(x / cell_size - neighbour.x - portal_pad,
				y / cell_size - neighbour.y - portal_pad);
			// console.log(dist,radius);
			if (dist < radius) {
				// console.log(neighbour.getText().join('<br>'));
				return neighbour;
			}
		}
	}
	if (!visibleStar.grid[cell_x]) return undefined;
	var obj = visibleStar.grid[cell_x][cell_y];
	if (!obj) return undefined;
	// console.log(obj);
	var radius = planet_size;
	var dist = Math.hypot(event.offsetX - (obj.x + 1 * portals_ext + portal_pad) * cell_size, event.offsetY - (obj.y + 1 * portals_ext + portal_pad) * cell_size);
	if (dist < radius) {
		return obj;
	}
}

function hint(event: MouseEvent) {
	const obj = objAt(event.offsetX, event.offsetY, event);
	hintTarget.innerHTML = obj ? hintText(obj).join('<br>') : "Space void";
}

function click(event: MouseEvent) {
	if (mode == 'flyi') return;
	const obj = objAt(event.offsetX, event.offsetY, event);
	if (obj instanceof Planet && shown_star == player_star) {
		if (flightplan.steps.findIndex(x => x.planet == obj) == flightplan.steps.length - 1) {
			flightplan.undo();
			redraw();
			flightplan.element.parentElement.scrollTop = 1000;
		} else if (!flightplan.cantTravelTo(obj)) {
			flightplan.add(obj);
			redraw();
			flightplan.element.parentElement.scrollTop = 1000;
		}
	}
	if (obj instanceof Direction && obj.target) {
		shown_star = obj.target;
		redraw();
		hint(event);
	}
	return;
}
