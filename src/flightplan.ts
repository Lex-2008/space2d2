import { Direction } from "./angle.js";
import { planet_size, cell_size } from "./draw.js";
import { intersect, lineCrossesObj } from "./geometry.js";
import { shown_star } from "./hints.js";
import { Planet } from "./planets.js";
import { Star } from "./stars.js";
import { player_star } from "./universe.js";

interface flightplanFirstStep {
	start: true,
	planet: { x: number, y: number },
	x: number, y: number,
	buy: false,
	sell: false,
	cargo: string | null,
}

interface flightplanStep {
	start: false,
	planet: Planet,
	x: number, y: number,
	buy: boolean,
	sell: boolean,
	cargo: string | null,
}

class Flightplan {
	steps: Array<flightplanFirstStep | flightplanStep>;
	// visited:[],
	element: HTMLDivElement;
	init(x: number, y: number, cargo: string | null, element: HTMLDivElement) {
		this.element = element;
		this.steps = [{
			start: true,
			planet: { x: x, y: y },
			x: x, y: y,
			buy: false,
			sell: false,
			cargo: cargo,
		} as flightplanFirstStep];
	};
	add(planet: Planet) {
		const oldIndex = this.steps.findIndex(x => x.planet == planet);
		// if(oldIndex == flightplan.steps.length-1) this.undo();
		if (oldIndex >= 0) return;
		// if(this.visited.indexOf(planet)>-1) return;
		// this.visited.push(planet);
		var cargo = this.lastStep.cargo;
		this.steps.push({
			start: false,
			planet: planet,
			x: planet.x,
			y: planet.y,
			buy: false,
			sell: false,
			cargo: cargo,
		} as flightplanStep);
		this.updateStep(this.steps.length - 1);
	};
	undo() {
		// don't remove first element - it's an initial state - how player arrived to this system
		if (this.steps.length <= 1) return;
		this.steps.pop();
	};
	canSell(i: number) {
		const step = this.steps[i] as flightplanStep;
		return !!step.planet.buys && this.steps[i - 1].cargo == step.planet.buys;
	};
	setSell(i: number, value: boolean, dontUpdate: boolean) {
		if (value && !this.canSell(i)) return;
		var step = this.steps[i];
		step.sell = value;
		if (!dontUpdate) this.updateStep(i, true, true);
	};
	canBuy(i: number) {
		const step = this.steps[i] as flightplanStep;
		return !!step.planet.sells && (!this.steps[i - 1].cargo || this.steps[i].sell);
	};
	setBuy(i: number, value: boolean, dontUpdate: boolean) {
		if (value && !this.canBuy(i)) return;
		const step = this.steps[i] as flightplanStep;
		step.buy = value;
		if (!dontUpdate) this.updateStep(i, true);
	}
	updateStep(i: number, changed?: boolean, noAutoSell?: boolean) {
		// RECURSIVE
		if (i >= this.steps.length) return;
		// console.log('updateStep',i,changed);
		const step = this.steps[i] as flightplanStep;
		if (noAutoSell) {
			// only disables sale if it's impossible
			if (step.sell && !this.canSell(i)) {
				step.sell = false;
				changed = true;
			}
		} else {
			// set sell to its possible value
			if (step.sell != this.canSell(i)) {
				step.sell = this.canSell(i);
				changed = true;
			}
		}
		if (step.buy && !this.canBuy(i)) {
			step.buy = false;
			changed = true;
		}
		var new_cargo = step.buy ? step.planet.sells : step.sell ? '' : this.steps[i - 1].cargo;
		changed = changed || step.cargo != new_cargo;
		step.cargo = new_cargo;
		if (changed) {
			this.updateStep(i + 1);
		}
	};
	countJobs() {
		// count all "sell" actions
		return this.steps.reduce((a: number, step: flightplanFirstStep | flightplanStep) => a += +step.sell, 0);
	};
	get lastStep() {
		const ret = this.steps.at(-1);
		if (!ret) throw new ReferenceError("flighplan should never be empty");
		return ret;
	}
	canPathTo(obj: Planet | Direction) {
		for (var i = 1; i < this.steps.length - 1; i++) {
			if (intersect(this.steps[i - 1].planet, this.steps[i].planet,
				this.lastStep.planet, obj))
				return false;
		}
		return true;
	};
	pathToCollidesWith(obj: Planet | Direction): string | false {
		if (lineCrossesObj(this.lastStep.planet, obj, player_star, 0.5)) return 'star';
		var size = planet_size / cell_size;
		// console.log(obj,this.steps.at(-1).planet);
		for (var planet of player_star.planets) {
			if (planet != obj && planet != this.lastStep.planet &&
				lineCrossesObj(this.lastStep.planet, obj, planet, size)) return planet.name + ' planet';
		}
		return false;
	};
	cantTravelTo(planet: Planet) {
		if (this.steps.findIndex(x => x.planet == planet) >= 0) return 'planet already in flight plan';
		if (!this.canPathTo(planet)) return 'crosses existing path';
		var name = this.pathToCollidesWith(planet);
		if (name) return 'path crosses ' + name;
		return false;
	};
	cantJumpTo(star: Star, direction: Direction) {
		if (star == player_star) return "you're currently at this star";
		if (star.visited) return "you've already been here";
		if (!this.canPathTo(direction)) return "path to portal crosses existing path";
		var name = this.pathToCollidesWith(direction);
		if (name) return 'path crosses ' + name;
		return false;
	};
}

export var flightplan = new Flightplan();

export function redrawFlightplan() {
	var html = flightplan.steps.map((step, i) => {
		var ret: string[] = [];
		if (step.start) {
			step = step as flightplanFirstStep;
			ret.push(`Arrived to <b>${player_star.name} star</b>` + (step.cargo ? ` with ${step.cargo}` : ''));
		} else {
			step = step as flightplanStep;
			ret.push(`<div><b>${i}: ${step.planet.name} planet</b>`);
			if (step.planet.buys) ret.push(`<label><input type="checkbox" ${step.sell ? 'checked' : ''} ${flightplan.canSell(i) ? '' : 'disabled'} onchange="flightplan.setSell(${i},this.checked);redrawFlightplan()"> Sell ${step.planet.buys}</label>`);
			if (step.planet.sells) ret.push(`<label><input type="checkbox" ${step.buy ? 'checked' : ''} ${flightplan.canBuy(i) ? '' : 'disabled'} onchange="flightplan.setBuy(${i},this.checked);redrawFlightplan()"> Buy ${step.planet.sells}</label>`);
			ret.push(`</div>`);
			if (step.cargo) ret.push(`Travel with ${step.cargo}`);
			else ret.push(`Travel empty`);
		}
		return ret.join(' ');
	}).join(' ');
	flightplan.element.innerHTML = html;
	document.getElementById('fp_undo').style.display = flightplan.steps.length <= 1 ? 'none' : '';
	document.getElementById('fp_hint').style.display = (shown_star == player_star) ? '' : 'none';

	document.getElementById('fp_jobs_done').innerText = '' + flightplan.countJobs();
	document.getElementById('fp_jobs_total').innerText = player_star.jobs;
	// document.getElementById('fp_jobs_prc').innerText=Math.round(flightplan.countJobs()/player_star.jobs*100);

	document.getElementById('fp_jump').style.display = (shown_star == player_star) ? 'none' : '';
	if (shown_star != player_star) {
		var reason = flightplan.cantJumpTo(shown_star, player_star.neighbours.directionOf(shown_star));
		document.getElementById('fp_jump_ok').style.display = reason ? 'none' : '';
		document.getElementById('fp_jump_ok_star').innerText = shown_star.name + ' star';
		document.getElementById('fp_jump_ok_jobs').innerText = '' + shown_star.jobs;
		document.getElementById('fp_jump_no').style.display = reason ? '' : 'none';
		document.getElementById('fp_jump_no_reason').innerText = reason || '';
	}
}
