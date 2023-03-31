var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var _Direction_value, _Directions_list;
function calc_xy(value, size) {
    var x = Math.cos(value / 180 * Math.PI);
    var y = -Math.sin(value / 180 * Math.PI);
    var scale = 1 / Math.max(Math.abs(x), Math.abs(y));
    // size-=1;
    size += portal_pad;
    x = x * scale * size / 2 + size / 2 - portal_pad / 2; //+0.5;
    y = y * scale * size / 2 + size / 2 - portal_pad / 2; //+0.5;
    return [x, y];
}
class Direction {
    // We could limit it to 0..360, but it would complicate calculating "to the left"/"to the right" values
    constructor(value, owner, target) {
        _Direction_value.set(this, void 0); //angle, value can be -179..+180.
        this.value = value;
        this.target = target;
        [this.x, this.y] = calc_xy(value, owner.size);
    }
    static normalize(value) {
        while (value <= -180)
            value += 360;
        while (value > +180)
            value -= 360;
        return value;
    }
    get value() { return __classPrivateFieldGet(this, _Direction_value, "f"); }
    set value(value) { __classPrivateFieldSet(this, _Direction_value, Direction.normalize(value), "f"); }
    angleTo(value) {
        if (value instanceof Direction)
            return this.angleTo(value.value);
        return Direction.normalize(value - __classPrivateFieldGet(this, _Direction_value, "f"));
    }
    positiveAngleTo(value) {
        const angle = this.angleTo(value);
        if (angle < 0)
            return angle + 360;
        return angle;
    }
    // // functions which return value (angle between two vectors, or their sum)
    add(value) {
        if (value instanceof Direction)
            return this.add(value.value);
        return Direction.normalize(__classPrivateFieldGet(this, _Direction_value, "f") + value);
    }
}
_Direction_value = new WeakMap();
class Directions {
    constructor(owner) {
        _Directions_list.set(this, []); // ordered list of directions
        this.owner = owner;
    }
    *[(_Directions_list = new WeakMap(), Symbol.iterator)]() {
        for (var item of __classPrivateFieldGet(this, _Directions_list, "f"))
            yield item;
    }
    add(new_item) {
        // console.trace(`adding ${new_item.value} to ${this.owner.name}`);
        let index = __classPrivateFieldGet(this, _Directions_list, "f").findIndex(item => item.value > new_item.value);
        if (index < 0)
            index = __classPrivateFieldGet(this, _Directions_list, "f").length;
        __classPrivateFieldGet(this, _Directions_list, "f").splice(index, 0, new_item);
        new_item.list = this;
    }
    // returns index of whatever is passed - either Direction, or is value
    indexOf(value) {
        if (value instanceof Direction)
            return __classPrivateFieldGet(this, _Directions_list, "f").indexOf(value);
        if (typeof value == "number") {
            value = Direction.normalize(value);
            return __classPrivateFieldGet(this, _Directions_list, "f").findIndex(item => item.value == value);
        }
        else {
            return __classPrivateFieldGet(this, _Directions_list, "f").findIndex(item => item.target == value);
        }
    }
    angleBetween(a, b) {
        if (!(a instanceof Direction))
            a = this.directionOf(a);
        if (!(b instanceof Direction))
            b = this.directionOf(b);
        return a.angleTo(b);
    }
    get count() { return __classPrivateFieldGet(this, _Directions_list, "f").length; }
    // returns Direction object with given target, or null if none found
    directionOf(value) {
        let index = this.indexOf(value);
        if (index < 0)
            return null;
        return __classPrivateFieldGet(this, _Directions_list, "f")[index];
    }
    // insert new item, or set a target of an existing one
    link(value, target) {
        let index = this.indexOf(value);
        if (index < 0) {
            this.add(new Direction(value, this.owner, target));
        }
        else {
            __classPrivateFieldGet(this, _Directions_list, "f")[index].target = target;
        }
    }
    // functions to navigate the list
    // if item is not in the list - returns first or last element
    next(item) {
        let index = this.indexOf(item);
        if (index < 0)
            return null;
        return __classPrivateFieldGet(this, _Directions_list, "f")[index + 1] || __classPrivateFieldGet(this, _Directions_list, "f")[0];
    }
    prev(item) {
        let index = this.indexOf(item);
        if (index < 0)
            return null;
        return __classPrivateFieldGet(this, _Directions_list, "f")[index - 1] || __classPrivateFieldGet(this, _Directions_list, "f").at(-1);
    }
    // aliases
    left(item) { return this.next(item); }
    right(item) { return this.prev(item); }
}
