import { Direction } from "./angle.js";
import { flightplan } from "./flightplan.js";
import { gebi } from "./index.js";
import { Planet } from "./planets.js";
import { Star } from "./stars.js";
import { player_star } from "./universe.js";

export var planet_size = 0;
export var cell_size = 0;
export var portal_size = 0;

// flag: if portals has are located outside of "planet area" (1)
// or same row/column as top-/bottom-/left-/right-most planets (0)
export var portals_ext = 0;

// extra space to reserve for portals
export const portal_pad = 0.5;

function draw_planet(ctx: CanvasRenderingContext2D, planet: Planet) {
	const x = (planet.x + 1 * portals_ext + portal_pad) * cell_size;
	const y = (planet.y + 1 * portals_ext + portal_pad) * cell_size;
	var grd = ctx.createRadialGradient(x - 1, y - 1, 2, x, y, planet_size);
	grd.addColorStop(0, planet.color_in);
	grd.addColorStop(1, planet.color_out);
	ctx.fillStyle = grd;
	ctx.beginPath();
	ctx.arc(x, y, planet_size, 0, 6);
	ctx.fill();
}

function draw_portal(ctx: CanvasRenderingContext2D, neighbour: Direction) {
	var x = (neighbour.x + portal_pad) * cell_size;
	var y = (neighbour.y + portal_pad) * cell_size;

	if (neighbour.target == player_star) draw_player_there(ctx, x, y, neighbour.value);

	ctx.strokeStyle = 'purple';
	if (neighbour.target) ctx.strokeStyle = 'violet';
	ctx.lineWidth = 3;
	var perimeter = Math.PI * portal_size;
	var dashes_count = Math.round(perimeter / 3);
	var dashes_length = perimeter / dashes_count;
	ctx.setLineDash([dashes_length, dashes_length]);
	ctx.beginPath();
	ctx.arc(x, y, portal_size, 0, 7);
	ctx.stroke();
}

function draw_player_here(ctx: CanvasRenderingContext2D, x: number, y: number) {
	const scale = 2;
	const size = (portal_size * 2 + 2) * scale;
	gebi('player_here').style.left = (x - size / 2 + 2) + 'px';
	gebi('player_here').style.top = (y - size / 2 + 2) + 'px';
	gebi('player_here').style.width = size + 'px';
	gebi('player_here').style.height = size + 'px';
}

function draw_player_there(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
	const r = portal_size * 1.73; // sqrt(3)
	const point_x = function (a: number) { return r * Math.cos((a + angle) / 180 * Math.PI) + x; }
	const point_y = function (a: number) { return -r * Math.sin((a + angle) / 180 * Math.PI) + y; }
	ctx.strokeStyle = 'purple';
	ctx.lineWidth = 4;
	ctx.setLineDash([1, 0]);
	ctx.beginPath();
	const s = 150;
	const t = 120;
	ctx.moveTo(point_x(s), point_y(s));
	ctx.lineTo(point_x(t), point_y(t));
	ctx.lineTo(point_x(0), point_y(0));
	ctx.lineTo(point_x(-t), point_y(-t));
	ctx.lineTo(point_x(-s), point_y(-s));
	ctx.stroke();
}


export function calc_sizes(ctx: CanvasRenderingContext2D, star: Star) {
	var max_size = ctx.canvas.width;
	cell_size = max_size / (star.size + 2 * portals_ext + 2 * portal_pad);
	planet_size = cell_size / 5;
	portal_size = portal_pad * cell_size / 5;
}

export function draw_star(ctx: CanvasRenderingContext2D, star: Star) {
	calc_sizes(ctx, star);
	var max_size = ctx.canvas.width;
	var center = max_size / 2;
	ctx.clearRect(0, 0, max_size, max_size);
	if (star.bright) {
		var grd = ctx.createRadialGradient(center, center, 0, center, center, cell_size / 2);
		grd.addColorStop(0, "white");
		grd.addColorStop(0.5, star.color);
		grd.addColorStop(1, "transparent");
		ctx.fillStyle = grd;
		ctx.fillRect(0, 0, max_size, max_size);
	} else {
		var grd = ctx.createRadialGradient(center, center, 10, center, center, cell_size / 2);
		grd.addColorStop(0, star.color);
		grd.addColorStop(1, "transparent");
		ctx.fillStyle = grd;
		ctx.fillRect(0, 0, max_size, max_size);
	}
	if (star == player_star) {
		// TODO: use flightplan.toXY here
		ctx.beginPath();
		var x0 = (flightplan.steps[0].x + portal_pad) * cell_size;
		var y0 = (flightplan.steps[0].y + portal_pad) * cell_size;
		ctx.moveTo(x0, y0);
		for (var i = 1; i < flightplan.steps.length; i++) {
			var x = (flightplan.steps[i].x + portal_pad) * cell_size;
			var y = (flightplan.steps[i].y + portal_pad) * cell_size;
			ctx.lineTo(x, y);
		}
		if (flightplan.exitPortal) {
			var x = (flightplan.exitPortal.x + portal_pad) * cell_size;
			var y = (flightplan.exitPortal.y + portal_pad) * cell_size;
			ctx.lineTo(x, y);
		}
		ctx.strokeStyle = 'purple';
		ctx.setLineDash([6, 6]);
		ctx.lineWidth = 3;
		ctx.stroke();

		draw_player_here(ctx, x0, y0);
	}
	for (var planet of star.planets) {
		draw_planet(ctx, planet);
	}
	for (var neighbour of star.neighbours) {
		draw_portal(ctx, neighbour);
	}
}

