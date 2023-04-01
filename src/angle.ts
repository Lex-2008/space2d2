import { portal_pad } from "./draw.js";
import { Planet } from "./planets.js";
import { Star } from "./stars.js";

function calc_xy(value: number, size: number): [number, number]{
	var x=Math.cos(value/180*Math.PI);
	var y=-Math.sin(value/180*Math.PI);
	var scale=1/Math.max(Math.abs(x),Math.abs(y));
	// size-=1;
	size+=portal_pad;
	x=x*scale*size/2+size/2-portal_pad/2;//+0.5;
	y=y*scale*size/2+size/2-portal_pad/2;//+0.5;
	return [x,y];
}

export class Direction {
	target: Star | undefined; //something this vector points at, can be null - not used by the class itself
	x: number; y: number; // portal coordinates, calculated during creation
	#value: number; //angle, value can be -179..+180.
	list: Directions; //optional, list which this direction is part of
	// We could limit it to 0..360, but it would complicate calculating "to the left"/"to the right" values
	constructor(value: number,owner: Star,target?: Star){
		this.value=value;
		this.target=target;
		[this.x, this.y]=calc_xy(value,owner.size);
	}
	static normalize(value: number): number{
		while(value<=-180) value+=360;
		while(value>+180) value-=360;
		return value;
	}
	get value() { return this.#value }
	set value(value) { this.#value = Direction.normalize(value) }
	angleTo(value: number | Direction) {
		if(value instanceof Direction) return this.angleTo(value.value);
		return Direction.normalize(value-this.#value);
	}
	positiveAngleTo(value: number | Direction): number {
		const angle = this.angleTo(value);
		if(angle<0) return angle+360;
		return angle;
	}
	// // functions which return value (angle between two vectors, or their sum)
	add(value: number){
		//if(value instanceof Direction) return this.add(value.value);
		return Direction.normalize(this.#value + value);
	}
	// sub(value){
	// 	if(value instanceof Direction) return this.sub(value.value);
	// 	return Direction.normalize(this.#value - value);
	// }
	// // functions which change value of this vector
	// inc(value){ this.#value = this.add(value) }
	// dec(value){ this.#value = this.sub(value) }
	// // handy functions which propagate to parent list
	// // they will return 'undefined' if this.list is not set
	// next() { return this.list && this.list.next(this) }
	// prev() { return this.list && this.list.prev(this) }
	// left() { return this.list && this.list.left(this) }
	// right() { return this.list && this.list.right(this) }
}

export class Directions {
	#list: Direction[]; // ordered list of directions
	owner: Star; // star, to which this list belongs to
	constructor(owner: Star){
		this.#list=[];
		this.owner=owner;
	}
	*[Symbol.iterator]() {
		for(var item of this.#list) yield item;
	}
	add(new_item: Direction){
		// console.trace(`adding ${new_item.value} to ${this.owner.name}`);
		let index=this.#list.findIndex(item=>item.value>new_item.value);
		if(index<0) index=this.#list.length;
		this.#list.splice(index,0,new_item);
		new_item.list=this;
	}
	// returns index of whatever is passed - either Direction, or is value
	indexOf(value: number | Direction | Star): number{
		if(value instanceof Direction) return this.#list.indexOf(value);
		if(typeof value == "number") {
			value = Direction.normalize(value);
			return this.#list.findIndex(item=>item.value==value);
		} else {
			return this.#list.findIndex(item=>item.target==value);
		}
	}
	angleBetween(a: number | Star | Direction, b: number | Star | Direction):number {
		const aa=(a instanceof Direction)?a:this.directionOf(a);
		const bb=(b instanceof Direction)?b:this.directionOf(b);
		if(aa==null || bb==null) throw new ReferenceError(`either ${a} or ${b} is not part of this list`);
		return aa.angleTo(bb);
	}
	get count() { return this.#list.length }
	// returns Direction object with given target, or null if none found
	directionOf(value: number | Star | Direction): Direction{
		let index = this.indexOf(value);
		if(index<0) throw ReferenceError("${item} is not part of ${this} directions list");
		return this.#list[index];
	}
	// insert new item, or set a target of an existing one
	link(value: number, target?: Star){
		let index = this.indexOf(value);
		if(index<0){
			this.add(new Direction(value, this.owner, target));
		} else {
			this.#list[index].target=target;
		}
	}
	// functions to navigate the list
	// if item is not in the list - returns first or last element
	next(item: number | Star | Direction): Direction{
		let index=this.indexOf(item);
		if(index<0) throw ReferenceError("${item} is not part of ${this} directions list");
		return this.#list[index+1] || this.#list[0];
	}
	prev(item: number | Star | Direction): Direction{
		let index=this.indexOf(item);
		if(index<0) throw ReferenceError("${item} is not part of ${this} directions list");
		return this.#list[index-1] || this.#list.at(-1);
	}
	// aliases
	left(item: number | Star | Direction){ return this.next(item) }
	right(item: number | Star | Direction){ return this.prev(item) }
}
