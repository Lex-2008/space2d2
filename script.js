// src/geometry.ts
function normVector(x, y) {
  const d = Math.hypot(x, y);
  return [x / d, y / d];
}
function scalarMul(v1, v2) {
  return v1[0] * v2[0] + v1[1] * v2[1];
}
function dotOnLine(a, b, p) {
  const v = normVector(a.x - b.x, a.y - b.y);
  const m = scalarMul(v, [p.x - b.x, p.y - b.y]);
  return [b.x + v[0] * m, b.y + v[1] * m];
}
function lineCrossesObj(a, b, p, size) {
  const [x, y] = dotOnLine(a, b, p);
  return x >= Math.min(a.x, b.x) && x <= Math.max(a.x, b.x) && y >= Math.min(a.y, b.y) && y <= Math.max(a.y, b.y) && Math.hypot(x - p.x, y - p.y) < size;
}
function area(a, b, c2) {
  return (b.x - a.x) * (c2.y - a.y) - (b.y - a.y) * (c2.x - a.x);
}
function intersect_1(a, b, c2, d) {
  if (a > b)
    [a, b] = [b, a];
  if (c2 > d)
    [c2, d] = [d, c2];
  return Math.max(a, c2) <= Math.min(b, d);
}
function intersect(a, b, c2, d) {
  return intersect_1(a.x, b.x, c2.x, d.x) && intersect_1(a.y, b.y, c2.y, d.y) && area(a, b, c2) * area(a, b, d) <= 0 && area(c2, d, a) * area(c2, d, b) <= 0;
}

// src/angle.ts
function calc_xy(value, size) {
  var x = Math.cos(value / 180 * Math.PI);
  var y = -Math.sin(value / 180 * Math.PI);
  var scale = 1 / Math.max(Math.abs(x), Math.abs(y));
  size += portal_pad;
  x = x * scale * size / 2 + size / 2 - portal_pad / 2;
  y = y * scale * size / 2 + size / 2 - portal_pad / 2;
  return [x, y];
}
var Direction = class {
  target;
  //something this vector points at, can be null - not used by the class itself
  x;
  y;
  // portal coordinates, calculated during creation
  #value;
  //angle, value can be -179..+180.
  list;
  //optional, list which this direction is part of
  // We could limit it to 0..360, but it would complicate calculating "to the left"/"to the right" values
  constructor(value, owner, target) {
    this.value = value;
    this.target = target;
    [this.x, this.y] = calc_xy(value, owner.size);
  }
  static normalize(value) {
    while (value <= -180)
      value += 360;
    while (value > 180)
      value -= 360;
    return value;
  }
  get value() {
    return this.#value;
  }
  set value(value) {
    this.#value = Direction.normalize(value);
  }
  angleTo(value) {
    if (value instanceof Direction)
      return this.angleTo(value.value);
    return Direction.normalize(value - this.#value);
  }
  positiveAngleTo(value) {
    const angle = this.angleTo(value);
    if (angle < 0)
      return angle + 360;
    return angle;
  }
  // // functions which return value (angle between two vectors, or their sum)
  add(value) {
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
};
var Directions = class {
  #list;
  // ordered list of directions
  owner;
  // star, to which this list belongs to
  constructor(owner) {
    this.#list = [];
    this.owner = owner;
  }
  *[Symbol.iterator]() {
    for (var item of this.#list)
      yield item;
  }
  add(new_item) {
    let index = this.#list.findIndex((item) => item.value > new_item.value);
    if (index < 0)
      index = this.#list.length;
    this.#list.splice(index, 0, new_item);
    new_item.list = this;
  }
  // returns index of whatever is passed - either Direction, or is value
  indexOf(value) {
    if (value instanceof Direction)
      return this.#list.indexOf(value);
    if (typeof value == "number") {
      value = Direction.normalize(value);
      return this.#list.findIndex((item) => item.value == value);
    } else {
      return this.#list.findIndex((item) => item.target == value);
    }
  }
  angleBetween(a, b) {
    const aa = a instanceof Direction ? a : this.directionOf(a);
    const bb = b instanceof Direction ? b : this.directionOf(b);
    if (aa == null || bb == null)
      throw new ReferenceError(`either ${a} or ${b} is not part of this list`);
    return aa.angleTo(bb);
  }
  get count() {
    return this.#list.length;
  }
  // returns Direction object with given target, or null if none found
  directionOf(value) {
    let index = this.indexOf(value);
    if (index < 0)
      throw ReferenceError("${item} is not part of ${this} directions list");
    return this.#list[index];
  }
  // insert new item, or set a target of an existing one
  link(value, target) {
    let index = this.indexOf(value);
    if (index < 0) {
      this.add(new Direction(value, this.owner, target));
    } else {
      this.#list[index].target = target;
    }
  }
  // functions to navigate the list
  // if item is not in the list - returns first or last element
  next(item) {
    let index = this.indexOf(item);
    if (index < 0)
      throw ReferenceError("${item} is not part of ${this} directions list");
    return this.#list[index + 1] || this.#list[0];
  }
  prev(item) {
    let index = this.indexOf(item);
    if (index < 0)
      throw ReferenceError("${item} is not part of ${this} directions list");
    return this.#list[index - 1] || this.#list.at(-1);
  }
  // aliases
  left(item) {
    return this.next(item);
  }
  right(item) {
    return this.prev(item);
  }
};

// src/utils.ts
function randomInt(a, b) {
  if (a > b)
    [a, b] = [b, a];
  return Math.floor(Math.random() * (b - a + 1)) + a;
}
function randomFrom(a) {
  return a[Math.floor(Math.random() * a.length)];
}
function shuffle(array) {
  return array.map((a) => ({ sort: Math.random(), value: a })).sort((a, b) => a.sort - b.sort).map((a) => a.value);
}
function seq(a) {
  return [...Array(a).keys()];
}

// src/planets.ts
var resources = ["water", "iron", "food", "radioactives"];
var planetTypes = function() {
  var colors = ["blue", "yellow", "green", "red"];
  var planetNamesTable = [
    // table: rows: what planet buys; columns: what planet sells; value: planet name
    [null, "water-mining", "farming", "burning"],
    ["ice", null, "hunting", "fire"],
    ["fishy", "bio-mining", null, "nuclear"],
    ["frozen", "hot mining", "ice-farming", null]
  ];
  var ret = [
    ["ocean", null, "water", "navy", "blue"],
    ["dry", "water", null, "blue", "white"],
    ["mining", null, "iron", "olive", "yellow"],
    ["populated", "food", null, "green", "lime"]
  ];
  for (var buy = 0; buy < 4; buy++) {
    for (var sell = 0; sell < 4; sell++) {
      if (buy == sell)
        continue;
      ret.push([planetNamesTable[buy][sell], resources[buy], resources[sell], colors[buy], colors[sell]]);
    }
  }
  return ret;
}();
var Planet = class {
  x;
  y;
  type;
  name;
  buys;
  sells;
  color_in;
  color_out;
  constructor(x, y, type_n) {
    var type = planetTypes[type_n];
    this.x = x;
    this.y = y;
    this.type = type_n;
    this.name = type[0];
    this.buys = type[1];
    this.sells = type[2];
    this.color_in = type[3];
    this.color_out = type[4];
  }
  save() {
    return [this.x, this.y, this.type];
  }
};
function isBad(x, y, size) {
  var center = size / 2;
  return x < center + 0.6 && x > center - 0.6 && y < center + 0.6 && y > center - 0.6;
}
function makePlanets(size) {
  var thisPlanetTypes = shuffle(seq(planetTypes.length));
  for (var _n = 0; _n < 100; _n++) {
    var bad = false;
    var ret = [];
    var xx = shuffle(seq(size));
    var yy = shuffle(seq(size));
    var center = size / 2;
    for (var i = 0; i < size; i++) {
      if (isBad(xx[i] + 0.5, yy[i] + 0.5, size)) {
        bad = true;
      }
      ret.push([xx[i] + 0.5, yy[i] + 0.5, thisPlanetTypes[i]]);
    }
    if (!bad)
      return ret;
  }
  console.error("should not be here");
  return [];
}

// src/stars.ts
var starColors = ["AliceBlue", "AntiqueWhite", "Aqua", "Aquamarine", "Azure", "Beige", "Bisque", "BlanchedAlmond", "Blue", "BlueViolet", "Brown", "BurlyWood", "CadetBlue", "Chartreuse", "Chocolate", "Coral", "CornflowerBlue", "Cornsilk", "Crimson", "Cyan", "DarkGray", "DarkGrey", "DarkKhaki", "DarkOrange", "DarkOrchid", "DarkSalmon", "DarkSeaGreen", "DarkTurquoise", "DarkViolet", "DeepPink", "DeepSkyBlue", "DimGray", "DodgerBlue", "FireBrick", "FloralWhite", "Fuchsia", "Gainsboro", "GhostWhite", "Gold", "Goldenrod", "Gray", "GreenYellow", "Grey", "Honeydew", "HotPink", "IndianRed", "Ivory", "Khaki", "Lavender", "LavenderBlush", "LawnGreen", "LemonChiffon", "LightBlue", "LightCoral", "LightCyan", "LightGoldenrodYellow", "LightGray", "LightGreen", "LightGrey", "LightPink", "LightSalmon", "LightSeaGreen", "LightSkyBlue", "LightSlateGray", "LightSlateGrey", "LightSteelBlue", "LightYellow", "Lime", "LimeGreen", "Linen", "Magenta", "MediumAquamarine", "MediumBlue", "MediumOrchid", "MediumPurple", "MediumSeaGreen", "MediumSlateBlue", "MediumSpringGreen", "MediumTurquoise", "MediumVioletRed", "MintCream", "MistyRose", "Moccasin", "NavajoWhite", "OldLace", "Orange", "OrangeRed", "Orchid", "PaleGoldenrod", "PaleGreen", "PaleTurquoise", "PaleVioletRed", "PapayaWhip", "PeachPuff", "Peru", "Pink", "Plum", "PowderBlue", "Red", "RosyBrown", "RoyalBlue", "Salmon", "SandyBrown", "Seashell", "Sienna", "Silver", "SkyBlue", "SlateBlue", "SlateGray", "SlateGrey", "Snow", "SpringGreen", "SteelBlue", "Tan", "Thistle", "Tomato", "Turquoise", "Violet", "Wheat", "White", "WhiteSmoke", "Yellow", "YellowGreen"];
function mkgrid(star, size) {
  var grid = seq(size + 2 * portals_ext).map((x2) => []);
  var center = (size - 1) / 2;
  for (var x = Math.floor(center); x <= Math.ceil(center); x++) {
    for (var y = Math.floor(center); y <= Math.ceil(center); y++) {
      grid[x + 1 * portals_ext][y + 1 * portals_ext] = star;
    }
  }
  return grid;
}
function countJobs(planets) {
  var data = { "null": { buys: 0, sells: 0 } };
  resources.forEach((x) => {
    data[x] = { buys: 0, sells: 0 };
  });
  planets.forEach((planet) => {
    data[String(planet.buys)].buys++;
    data[String(planet.sells)].sells++;
  });
  var jobs = 0;
  resources.forEach((x) => {
    jobs += Math.min(data[x].buys, data[x].sells);
  });
  return jobs;
}
var Star = class {
  color;
  size;
  visited;
  x;
  y;
  bright;
  name;
  neighbours;
  grid;
  planets;
  jobs;
  constructor(load) {
    if (!load) {
      load = {
        c: randomFrom(starColors),
        s: randomInt(5, 9),
        n: false,
        p: false,
        v: false
      };
    }
    this.color = load.c;
    this.size = load.s;
    this.visited = load.v;
    this.x = this.y = this.size / 2;
    this.bright = false;
    this.name = this.color;
    if (this.size % 2 == 0) {
      this.bright = true;
      this.name = "bright " + this.name;
    }
    this.neighbours = new Directions(this);
    if (load.n) {
      for (var value of load.n) {
        this.neighbours.add(new Direction(value, this));
      }
    }
    this.grid = mkgrid(this, this.size);
    if (!load.p)
      load.p = makePlanets(this.size);
    this.planets = load.p.map((x) => new Planet(...x));
    for (var planet of this.planets) {
      this.grid[Math.floor(planet.x) + 1 * portals_ext][Math.floor(planet.y) + 1 * portals_ext] = planet;
    }
    this.jobs = countJobs(this.planets);
  }
  link(other, direction) {
    if (direction instanceof Direction) {
      direction.target = other;
      other.neighbours.link(direction.value + 180, this);
    } else {
      this.neighbours.link(direction, other);
      other.neighbours.link(direction + 180, this);
    }
  }
  save() {
    return {
      c: this.color,
      s: this.size,
      n: Array.from(this.neighbours).map((x) => x.value),
      p: this.planets.map((x) => x.save()),
      v: this.visited
    };
  }
};

// src/universe.ts
var player_star;
function set_player_star(x) {
  player_star = x;
}
var default_universe = '{"v":1,"s":{"c":"Yellow","s":4,"n":[-134,-71,-18,34,110,177],"p":[[2.5,0.5,3],[1.5,3.5,0],[3.5,2.5,5]],"v":false},"n":[{"c":"LightGreen","s":5,"n":[-145,-80,-8,46,99,151],"p":[[4.5,2.5,2],[1.5,0.5,9],[3.5,3.5,7],[2.5,1.5,12],[0.5,4.5,11]],"v":0},{"c":"LightGray","s":5,"n":[-128,-77,-27,46,109,172],"p":[[2.5,4.5,1],[3.5,2.5,9],[1.5,1.5,10],[0.5,3.5,15],[4.5,0.5,0]],"v":false},{"c":"Peru","s":5,"n":[-134,-79,-52,-9,34,98,162],"p":[[1.5,2.5,9],[4.5,1.5,6],[2.5,4.5,2],[3.5,0.5,0],[0.5,3.5,12]],"v":false},{"c":"Bisque","s":5,"n":[-146,-82,-19,9,52,94,169],"p":[[3.5,1.5,4],[1.5,3.5,9],[2.5,4.5,14],[0.5,2.5,2],[4.5,0.5,10]],"v":false},{"c":"LightBlue","s":6,"n":[-137,-70,-11,41,92,156],"p":[[1.5,3.5,13],[4.5,5.5,4],[5.5,2.5,6],[3.5,0.5,15],[2.5,4.5,3],[0.5,1.5,0]],"v":false},{"c":"LightSeaGreen","s":5,"n":[-144,-81,-3,43,88,154],"p":[[4.5,2.5,13],[3.5,4.5,14],[1.5,0.5,7],[2.5,3.5,11],[0.5,1.5,3]],"v":1}],"f":{"x":-0.25,"y":1.882,"c":null},"st":{"p":0,"s":0,"jf":0,"js":0}}';
function measureAngle(x, a, b) {
  return x.neighbours.directionOf(a).angleTo(x.neighbours.directionOf(b));
}
function moveToNewStar(star, oldStar) {
  var newStars = [];
  for (var connection of star.neighbours) {
    if (!connection.target) {
      var newStar = new Star();
      star.link(newStar, connection);
      newStars.push(newStar);
    }
  }
  var commonNeighbour = star.neighbours.left(oldStar).target;
  if (!commonNeighbour)
    throw ReferenceError(`${star} and ${oldStar} have no common neighbour on the left`);
  var newNeighbour = star.neighbours.left(commonNeighbour).target;
  if (!newNeighbour)
    throw ReferenceError(`${star} has no neighbour to the left from common neighbour`);
  var connectionToUse = commonNeighbour.neighbours.right(star);
  commonNeighbour.link(newNeighbour, connectionToUse);
  var a = commonNeighbour.neighbours.angleBetween(
    commonNeighbour.neighbours.right(newNeighbour),
    newNeighbour
  );
  var newValue = randomInt(100 - a, Math.min(160 - a, 80));
  console.log(`setting new angle to ${newValue} to have triangle ${a} - ${newValue} - ${180 - a - newValue}`);
  newDirection = new Direction(newNeighbour.neighbours.directionOf(commonNeighbour).add(newValue), newNeighbour);
  newNeighbour.neighbours.add(newDirection);
  var commonNeighbour = star.neighbours.right(oldStar).target;
  if (!commonNeighbour)
    throw ReferenceError(`${star} and ${oldStar} have no common neighbour on the right`);
  var newNeighbour = star.neighbours.right(commonNeighbour).target;
  if (!newNeighbour)
    throw ReferenceError(`${star} has no neighbour to the right from common neighbour`);
  var connectionToUse = commonNeighbour.neighbours.left(star);
  commonNeighbour.link(newNeighbour, connectionToUse);
  var a = commonNeighbour.neighbours.angleBetween(
    newNeighbour,
    commonNeighbour.neighbours.left(newNeighbour)
  );
  var newValue = randomInt(100 - a, Math.min(160 - a, 80));
  console.log(`setting new angle to ${newValue} to have triangle ${a} - ${newValue} - ${180 - a - newValue}`);
  newDirection = new Direction(newNeighbour.neighbours.directionOf(commonNeighbour).add(-newValue), newNeighbour);
  newNeighbour.neighbours.add(newDirection);
  for (var leftStar of newStars) {
    var leftDirection = star.neighbours.directionOf(leftStar);
    var rightDirection = star.neighbours.right(leftDirection);
    var rightStar = rightDirection.target;
    if (!rightStar)
      throw ReferenceError(`${star} has no neighbour to the right from ${leftStar}`);
    if (newStars.indexOf(rightStar) < 0)
      continue;
    if (star.neighbours.left(rightStar).target != leftStar)
      console.error("e0", leftStar, rightStar);
    if (leftDirection.target != leftStar)
      console.error("e1", leftDirection, leftStar);
    var bisect = leftDirection.add(Math.round(leftDirection.angleTo(rightDirection) / 2));
    console.log(`linking ${leftStar.name} and ${rightStar.name}`);
    leftStar.link(rightStar, bisect - 90);
    var a = randomInt(20, 80);
    var b = randomInt(100 - a, Math.min(160 - a, 80));
    if (180 - a - b < 20 || 180 - a - b > 80)
      console.error("e3", a, b);
    var newDirection = new Direction(leftStar.neighbours.directionOf(rightStar).add(a), leftStar);
    leftStar.neighbours.add(newDirection);
    var newDirection = new Direction(rightStar.neighbours.directionOf(leftStar).add(-b), rightStar);
    rightStar.neighbours.add(newDirection);
  }
  for (var newStar of newStars) {
    var fromDirection = newStar.neighbours.next(newStar.neighbours.next(star));
    var toDirection = newStar.neighbours.prev(newStar.neighbours.prev(star));
    var degreesToSplit = fromDirection.positiveAngleTo(toDirection);
    var lastAdded = 0;
    for (var newValue = randomInt(20, 80); newValue < degreesToSplit - 20; newValue += randomInt(20, 80)) {
      console.log(`got ${newValue} will be ${fromDirection.add(newValue)}`);
      var newDirection = new Direction(fromDirection.add(newValue), newStar);
      newStar.neighbours.add(newDirection);
      lastAdded = newValue;
    }
    console.log(`loop done with ${degreesToSplit - lastAdded} gap`);
    if (degreesToSplit - lastAdded > 80) {
      newValue = randomInt(lastAdded + 20, degreesToSplit - 20);
      console.log(`adding ${newValue} (will be ${fromDirection.add(newValue)}) to fill the gap`);
      newDirection = new Direction(fromDirection.add(newValue), newStar);
      newStar.neighbours.add(newDirection);
    }
  }
  var keepNeighbours = [star, star.neighbours.left(oldStar).target, star.neighbours.right(oldStar).target];
  for (var oldConnection of oldStar.neighbours) {
    if (keepNeighbours.indexOf(oldConnection.target) < 0) {
      oldConnection.target = void 0;
    }
  }
  star.neighbours.left(oldStar).target.neighbours.left(oldStar).target = void 0;
  star.neighbours.right(oldStar).target.neighbours.right(oldStar).target = void 0;
}
var stats;
function saveUniverse() {
  return {
    v: 1,
    s: player_star.save(),
    n: Array.from(player_star.neighbours).map((n) => n.target.save()),
    f: {
      x: flightplan.steps[0].x,
      y: flightplan.steps[0].y,
      c: flightplan.steps[0].cargo
    },
    st: stats
  };
}
function loadUniverse(data) {
  if (data.v != 1)
    return;
  player_star = new Star(data.s);
  var newStars = [];
  for (var i = 0; i < data.n.length; i++) {
    var newStar = new Star(data.n[i]);
    newStars.push(newStar);
    player_star.link(newStar, data.s.n[i]);
  }
  for (var leftStar of newStars) {
    var rightStar = player_star.neighbours.right(leftStar).target;
    leftStar.neighbours.left(player_star).target = rightStar;
    rightStar.neighbours.right(player_star).target = leftStar;
  }
  flightplan.init(data.f.x, data.f.y, data.f.c, document.getElementById("myFlightplan"));
  stats = data.st;
}
function check() {
  var ok = true;
  for (var c2 of player_star.neighbours) {
    if (!c2.target) {
      console.error("player_star has no neighbour at", c2.value);
      ok = false;
      continue;
    }
    if (Direction.normalize(c2.value + 180) != c2.target.neighbours.directionOf(player_star).value) {
      console.error(
        "player_star and ... dont point to each other",
        c2.target.name,
        Direction.normalize(c2.value + 180),
        c2.target.neighbours.directionOf(player_star).value
      );
      ok = false;
    }
    if (player_star.neighbours.left(c2).target != c2.target.neighbours.right(player_star).target) {
      console.error("left (as seen from player_star) and right from ... dont match", c2.target.name);
      ok = false;
    }
    if (player_star.neighbours.right(c2).target != c2.target.neighbours.left(player_star).target) {
      console.error("right (as seen from player_star) and left from ... dont match", c2.target.name);
      ok = false;
    }
    var dirToNextNeighbour = c2.target.neighbours.next(player_star);
    var nextNeighbour = dirToNextNeighbour.target;
    if (!nextNeighbour) {
      console.error("player_star has no neighbour after", c2.target.name);
      ok = false;
      continue;
    }
    if (nextNeighbour.neighbours.directionOf(c2.target).value != Direction.normalize(dirToNextNeighbour.value + 180)) {
      console.error(
        "neighbours dont point to each other",
        c2.target.name,
        nextNeighbour.name,
        nextNeighbour.neighbours.directionOf(c2.target).value,
        Direction.normalize(dirToNextNeighbour.value + 180)
      );
      ok = false;
    }
    if (measureAngle(c2.target, c2.target.neighbours.prev(nextNeighbour), nextNeighbour) + measureAngle(nextNeighbour, c2.target, nextNeighbour.neighbours.next(c2.target)) < 100) {
      console.error(
        "future common neighbour of two neighbours will have bad angle",
        c2.target.name,
        nextNeighbour.name,
        180 - measureAngle(c2.target, c2.target.neighbours.prev(nextNeighbour), nextNeighbour) - measureAngle(nextNeighbour, c2.target, nextNeighbour.neighbours.next(c2.target))
      );
      ok = false;
    }
    var badAngles = Array.from(c2.target.neighbours).map((x) => x.angleTo(c2.target.neighbours.next(x))).filter((x) => Math.abs(x) < 20 || Math.abs(x) > 80);
    if (badAngles.length) {
      console.error("neighbour has bad angles", c2.target.name, badAngles);
      ok = false;
    }
  }
  var badAngles = Array.from(player_star.neighbours).map((x) => x.angleTo(player_star.neighbours.next(x))).filter((x) => Math.abs(x) < 20 || Math.abs(x) > 80);
  if (badAngles.length) {
    console.error("player_star has bad angles");
    ok = false;
  }
  return ok;
}

// src/hints.ts
var shown_star;
function set_shown_star(x) {
  shown_star = x;
}
var hintTarget;
var visibleStar;
function setupHints(star, canvas, hintTargetObj) {
  visibleStar = star;
  canvas.onmousemove = hint;
  hintTarget = hintTargetObj;
  canvas.onmouseleave = function() {
    hintTarget.innerText = "Hover an object on the map to see what it is";
  };
  canvas.onclick = click;
}
function hintText(obj) {
  if (obj instanceof Direction) {
    if (!obj.target)
      return ["Portal to unknown" + (mode == "test" ? " at" + obj.value : "")];
    var ret = ["Portal to " + hintText(obj.target) + (mode == "test" ? " at" + obj.value : "")];
    if (mode == "flyi")
      return ret;
    if (shown_star == player_star) {
      if (Math.abs(obj.x - flightplan.steps[0].x) < 1e-3 && Math.abs(obj.y - flightplan.steps[0].y) < 1e-3) {
        ret.push("(you are here)");
      } else {
        var reason = flightplan.cantJumpTo(obj.target, obj);
        if (reason)
          ret.push("You can't travel there: " + reason);
        else
          ret.push("You can travel there");
      }
    } else {
      if (obj.target == player_star)
        ret = ret.concat(["(you are there)", "Click to return"]);
      else if (obj.target.visited)
        ret.push("(you've been there before)");
    }
    if (obj.target != player_star) {
      ret.push("Click to explore");
    }
    return ret;
  } else if (obj instanceof Planet) {
    var ret = [obj.name + " planet"];
    if (obj.buys)
      ret.push("Buys: " + obj.buys);
    if (obj.sells)
      ret.push("Sells: " + obj.sells);
    if (shown_star == player_star && mode != "flyi") {
      var reason = flightplan.cantTravelTo(obj);
      if (flightplan.lastStep.planet == obj) {
        ret.push("Click to remove it from the flight plan");
      } else if (reason) {
        ret.push(`Can't travel there: ${reason}`);
      } else {
        ret.push("Click to add it to the flight plan");
      }
    }
    return ret;
  } else if (obj instanceof Star) {
    return [obj.name + " star"];
  }
  return ["Unknown object"];
}
function objAt(x, y, event) {
  var cell_x = Math.floor(x / cell_size - portal_pad);
  var cell_y = Math.floor(y / cell_size - portal_pad);
  if (cell_x < 0 || cell_x >= visibleStar.size || cell_y < 0 || cell_y >= visibleStar.size) {
    var radius = portal_size / cell_size;
    for (var neighbour of visibleStar.neighbours) {
      var dist = Math.hypot(
        x / cell_size - neighbour.x - portal_pad,
        y / cell_size - neighbour.y - portal_pad
      );
      if (dist < radius) {
        return neighbour;
      }
    }
  }
  if (!visibleStar.grid[cell_x])
    return void 0;
  var obj = visibleStar.grid[cell_x][cell_y];
  if (!obj)
    return void 0;
  var radius = planet_size;
  var dist = Math.hypot(event.offsetX - (obj.x + 1 * portals_ext + portal_pad) * cell_size, event.offsetY - (obj.y + 1 * portals_ext + portal_pad) * cell_size);
  if (dist < radius) {
    return obj;
  }
}
function hint(event) {
  const obj = objAt(event.offsetX, event.offsetY, event);
  hintTarget.innerHTML = obj ? hintText(obj).join("<br>") : "Space void";
}
function click(event) {
  if (mode == "flyi")
    return;
  const obj = objAt(event.offsetX, event.offsetY, event);
  if (obj instanceof Planet && shown_star == player_star) {
    if (flightplan.steps.findIndex((x) => x.planet == obj) == flightplan.steps.length - 1) {
      flightplan.undo();
      redraw();
      flightplan.element.parentElement.scrollTop = 1e3;
    } else if (!flightplan.cantTravelTo(obj)) {
      flightplan.add(obj);
      redraw();
      flightplan.element.parentElement.scrollTop = 1e3;
    }
  }
  if (obj instanceof Direction && obj.target) {
    shown_star = obj.target;
    redraw();
    hint(event);
  }
  return;
}

// src/flightplan.ts
var Flightplan = class {
  steps;
  // visited:[],
  element;
  init(x, y, cargo, element) {
    this.element = element;
    this.steps = [{
      start: true,
      planet: { x, y },
      x,
      y,
      buy: false,
      sell: false,
      cargo
    }];
  }
  add(planet) {
    const oldIndex = this.steps.findIndex((x) => x.planet == planet);
    if (oldIndex >= 0)
      return;
    var cargo = this.lastStep.cargo;
    this.steps.push({
      start: false,
      planet,
      x: planet.x,
      y: planet.y,
      buy: false,
      sell: false,
      cargo
    });
    this.updateStep(this.steps.length - 1);
  }
  undo() {
    if (this.steps.length <= 1)
      return;
    this.steps.pop();
  }
  canSell(i) {
    const step = this.steps[i];
    return !!step.planet.buys && this.steps[i - 1].cargo == step.planet.buys;
  }
  setSell(i, value, dontUpdate) {
    if (value && !this.canSell(i))
      return;
    var step = this.steps[i];
    step.sell = value;
    if (!dontUpdate)
      this.updateStep(i, true, true);
  }
  canBuy(i) {
    const step = this.steps[i];
    return !!step.planet.sells && (!this.steps[i - 1].cargo || this.steps[i].sell);
  }
  setBuy(i, value, dontUpdate) {
    if (value && !this.canBuy(i))
      return;
    const step = this.steps[i];
    step.buy = value;
    if (!dontUpdate)
      this.updateStep(i, true);
  }
  updateStep(i, changed, noAutoSell) {
    if (i >= this.steps.length)
      return;
    const step = this.steps[i];
    if (noAutoSell) {
      if (step.sell && !this.canSell(i)) {
        step.sell = false;
        changed = true;
      }
    } else {
      if (step.sell != this.canSell(i)) {
        step.sell = this.canSell(i);
        changed = true;
      }
    }
    if (step.buy && !this.canBuy(i)) {
      step.buy = false;
      changed = true;
    }
    var new_cargo = step.buy ? step.planet.sells : step.sell ? "" : this.steps[i - 1].cargo;
    changed = changed || step.cargo != new_cargo;
    step.cargo = new_cargo;
    if (changed) {
      this.updateStep(i + 1);
    }
  }
  countJobs() {
    return this.steps.reduce((a, step) => a += +step.sell, 0);
  }
  get lastStep() {
    const ret = this.steps.at(-1);
    if (!ret)
      throw new ReferenceError("flighplan should never be empty");
    return ret;
  }
  canPathTo(obj) {
    for (var i = 1; i < this.steps.length - 1; i++) {
      if (intersect(
        this.steps[i - 1].planet,
        this.steps[i].planet,
        this.lastStep.planet,
        obj
      ))
        return false;
    }
    return true;
  }
  pathToCollidesWith(obj) {
    if (lineCrossesObj(this.lastStep.planet, obj, player_star, 0.5))
      return "star";
    var size = planet_size / cell_size;
    for (var planet of player_star.planets) {
      if (planet != obj && planet != this.lastStep.planet && lineCrossesObj(this.lastStep.planet, obj, planet, size))
        return planet.name + " planet";
    }
    return false;
  }
  cantTravelTo(planet) {
    if (this.steps.findIndex((x) => x.planet == planet) >= 0)
      return "planet already in flight plan";
    if (mode == "easy")
      return false;
    if (!this.canPathTo(planet))
      return "crosses existing path";
    var name = this.pathToCollidesWith(planet);
    if (name)
      return "path crosses " + name;
    return false;
  }
  cantJumpTo(star, direction) {
    if (star == player_star)
      return "you're currently at this star";
    if (star.visited)
      return "you've already been here";
    if (mode == "easy")
      return false;
    if (!this.canPathTo(direction))
      return "path to portal crosses existing path";
    var name = this.pathToCollidesWith(direction);
    if (name)
      return "path crosses " + name;
    return false;
  }
};
var flightplan = new Flightplan();
function redrawFlightplan() {
  var html = flightplan.steps.map((step, i) => {
    var ret = [];
    if (step.start) {
      step = step;
      ret.push(`Arrived to <b>${player_star.name} star</b>` + (step.cargo ? ` with ${step.cargo}` : ""));
    } else {
      step = step;
      ret.push(`<div><b>${i}: ${step.planet.name} planet</b>`);
      if (step.planet.buys)
        ret.push(`<label><input type="checkbox" ${step.sell ? "checked" : ""} ${flightplan.canSell(i) ? "" : "disabled"} onchange="flightplan.setSell(${i},this.checked);redrawFlightplan()"> Sell ${step.planet.buys}</label>`);
      if (step.planet.sells)
        ret.push(`<label><input type="checkbox" ${step.buy ? "checked" : ""} ${flightplan.canBuy(i) ? "" : "disabled"} onchange="flightplan.setBuy(${i},this.checked);redrawFlightplan()"> Buy ${step.planet.sells}</label>`);
      ret.push(`</div>`);
      if (step.cargo)
        ret.push(`Travel with ${step.cargo}`);
      else
        ret.push(`Travel empty`);
    }
    return ret.join(" ");
  }).join(" ");
  flightplan.element.innerHTML = html;
  gebi("fp_undo").style.display = flightplan.steps.length <= 1 ? "none" : "";
  gebi("fp_hint").style.display = shown_star == player_star ? "" : "none";
  gebi("fp_jobs_done").innerText = "" + flightplan.countJobs();
  gebi("fp_jobs_total").innerText = "" + player_star.jobs;
  gebi("fp_jump").style.display = shown_star == player_star ? "none" : "";
  if (shown_star != player_star) {
    var reason = flightplan.cantJumpTo(shown_star, player_star.neighbours.directionOf(shown_star));
    gebi("fp_jump_ok").style.display = reason ? "none" : "";
    gebi("fp_jump_ok_star").innerText = shown_star.name + " star";
    gebi("fp_jump_ok_jobs").innerText = "" + shown_star.jobs;
    gebi("fp_jump_no").style.display = reason ? "" : "none";
    gebi("fp_jump_no_reason").innerText = reason || "";
  }
}

// src/draw.ts
var planet_size = 0;
var cell_size = 0;
var portal_size = 0;
var portals_ext = 0;
var portal_pad = 0.5;
function draw_planet(ctx2, planet) {
  const x = (planet.x + 1 * portals_ext + portal_pad) * cell_size;
  const y = (planet.y + 1 * portals_ext + portal_pad) * cell_size;
  var grd = ctx2.createRadialGradient(x - 1, y - 1, 2, x, y, planet_size);
  grd.addColorStop(0, planet.color_in);
  grd.addColorStop(1, planet.color_out);
  ctx2.fillStyle = grd;
  ctx2.beginPath();
  ctx2.arc(x, y, planet_size, 0, 6);
  ctx2.fill();
}
function draw_portal(ctx2, neighbour) {
  var x = (neighbour.x + portal_pad) * cell_size;
  var y = (neighbour.y + portal_pad) * cell_size;
  if (neighbour.target == player_star)
    draw_player_there(ctx2, x, y, neighbour.value);
  ctx2.strokeStyle = "purple";
  if (neighbour.target)
    ctx2.strokeStyle = "violet";
  ctx2.lineWidth = 3;
  var perimeter = Math.PI * portal_size;
  var dashes_count = Math.round(perimeter / 3);
  var dashes_length = perimeter / dashes_count;
  ctx2.setLineDash([dashes_length, dashes_length]);
  ctx2.beginPath();
  ctx2.arc(x, y, portal_size, 0, 7);
  ctx2.stroke();
}
function draw_player_here(ctx2, x, y) {
  ctx2.strokeStyle = "violet";
  ctx2.fillStyle = "purple";
  ctx2.lineWidth = 3;
  ctx2.setLineDash([1, 0]);
  ctx2.beginPath();
  ctx2.arc(x, y, portal_size, 0, 7);
  ctx2.fill();
}
function draw_player_there(ctx2, x, y, angle) {
  const r = portal_size * 1.73;
  const point_x = function(a) {
    return r * Math.cos((a + angle) / 180 * Math.PI) + x;
  };
  const point_y = function(a) {
    return -r * Math.sin((a + angle) / 180 * Math.PI) + y;
  };
  const side = r * 3.46;
  const height = r * 3;
  ctx2.strokeStyle = "purple";
  ctx2.lineWidth = 4;
  ctx2.setLineDash([1, 0]);
  ctx2.beginPath();
  const s = 150;
  const t = 120;
  ctx2.moveTo(point_x(s), point_y(s));
  ctx2.lineTo(point_x(t), point_y(t));
  ctx2.lineTo(point_x(0), point_y(0));
  ctx2.lineTo(point_x(-t), point_y(-t));
  ctx2.lineTo(point_x(-s), point_y(-s));
  ctx2.stroke();
}
function draw_star(ctx2, star) {
  var max_size = ctx2.canvas.width;
  cell_size = max_size / (star.size + 2 * portals_ext + 2 * portal_pad);
  planet_size = cell_size / 5;
  portal_size = portal_pad * cell_size / 5;
  var center = max_size / 2;
  if (star.bright) {
    var grd = ctx2.createRadialGradient(center, center, 0, center, center, cell_size / 2);
    grd.addColorStop(0, "white");
    grd.addColorStop(0.5, star.color);
    grd.addColorStop(1, "black");
    ctx2.fillStyle = grd;
    ctx2.fillRect(0, 0, max_size, max_size);
  } else {
    var grd = ctx2.createRadialGradient(center, center, 10, center, center, cell_size / 2);
    grd.addColorStop(0, star.color);
    grd.addColorStop(1, "black");
    ctx2.fillStyle = grd;
    ctx2.fillRect(0, 0, max_size, max_size);
  }
  if (star == player_star) {
    ctx2.beginPath();
    var x0 = (flightplan.steps[0].x + portal_pad) * cell_size;
    var y0 = (flightplan.steps[0].y + portal_pad) * cell_size;
    ctx2.moveTo(x0, y0);
    for (var i = 1; i < flightplan.steps.length; i++) {
      var x = (flightplan.steps[i].x + portal_pad) * cell_size;
      var y = (flightplan.steps[i].y + portal_pad) * cell_size;
      ctx2.lineTo(x, y);
    }
    ctx2.strokeStyle = "purple";
    ctx2.setLineDash([6, 6]);
    ctx2.lineWidth = 3;
    ctx2.stroke();
    draw_player_here(ctx2, x0, y0);
  } else {
  }
  for (var planet of star.planets) {
    draw_planet(ctx2, planet);
  }
  for (var neighbour of star.neighbours) {
    draw_portal(ctx2, neighbour);
  }
}

// src/index.ts
function gebi(id) {
  const element = document.getElementById(id);
  if (!element)
    throw ReferenceError(`element ${id} not found`);
  return element;
}
var mode;
var c = gebi("myCanvas");
var ctx = c.getContext("2d");
var real_savegame_id;
var flyi_time = 1e3 * 60 * 60 * 10;
var flyi_finish;
var flyi_interval;
function redraw() {
  draw_star(ctx, shown_star);
  setupHints(shown_star, c, gebi("hints"));
  redrawFlightplan();
  gebi("mapTitle_player").style.display = shown_star == player_star ? "" : "none";
  gebi("mapTitle_neighbour").style.display = shown_star == player_star ? "none" : "";
  if (shown_star != player_star) {
    gebi("mapTitle_neighbour_n").innerText = "" + player_star.neighbours.indexOf(shown_star) + 1;
    gebi("mapTitle_neighbour_total").innerText = "" + player_star.neighbours.count;
  }
  gebi("stats_s").innerText = "" + stats.s;
  gebi("stats_p").innerText = "" + stats.p;
  gebi("stats_js").innerText = "" + stats.js;
  gebi("stats_jf").innerText = "" + stats.jf;
  gebi("stats_jf_s").innerText = "" + Math.round(stats.jf / stats.s * 100) / 100;
  gebi("stats_jf_p").innerText = "" + Math.round(stats.jf / stats.p * 100);
  gebi("stats_jf_js").innerText = "" + Math.round(stats.jf / stats.js * 100);
}
window.onhashchange = async function() {
  mode = location.hash.slice(1);
  if (["test", "easy", "hard", "real"].indexOf(mode) == -1) {
    history.replaceState(0, "", location.pathname);
    gebi("select_mode").showModal();
    return;
  }
  if (mode == "test")
    return start_game(JSON.parse(default_universe));
  if (["easy", "hard"].indexOf(mode) > -1)
    return start_game(JSON.parse(localStorage["space2d2" + mode] || default_universe));
  const m = await import("../js-sdk/dist/pocketbase.es.mjs");
  const PocketBase = m.default;
  const pb = new PocketBase("http://127.0.0.1:8090");
  save_game = async function() {
    console.log("real mode save_game");
    if (real_savegame_id) {
      pb.collection("real").update(real_savegame_id, {
        data: saveUniverse()
      });
    } else {
      var r = await pb.collection("real").create({
        user: pb.authStore.model.id,
        data: saveUniverse()
      });
      real_savegame_id = r.id;
    }
  };
  pb.collection("users").authRefresh({}, { expand: "real(user)" }).then(
    start_real_game,
    () => setup_login_flow(pb)
  );
};
function setup_login_flow(pb) {
  window.login = function() {
    pb.collection("users").authWithPassword(
      gebi("login_email").value,
      gebi("login_password").value,
      {},
      { expand: "real(user)" }
    ).then((r) => {
      gebi("login").close();
      start_real_game(r);
    }, (e) => {
      console.log(e);
      gebi("login_failure").style.display = "";
      gebi("login_details").innerText = JSON.stringify(e.response, null, 2);
    });
  };
  window.register = function() {
    pb.collection("users").create({
      username: gebi("register_username").value,
      email: gebi("register_email").value,
      password: gebi("register_password").value,
      passwordConfirm: gebi("register_password").value
    }).then(async (r) => {
      if (gebi("register_username").value) {
        gebi("login_email").value = gebi("register_username").value;
      }
      if (gebi("register_email").value) {
        gebi("login_email").value = gebi("register_email").value;
      }
      gebi("login_password").value = gebi("register_password").value;
      gebi("register").close();
      gebi("register_to_login").showModal();
    }, (e) => {
      console.log(e);
      gebi("register_failure").style.display = "";
      gebi("register_details").innerText = JSON.stringify(e.response, null, 2);
    });
  };
  gebi("login").showModal();
}
function start_real_game(r) {
  const ex = r.record.expand["real(user)"];
  if (!ex || !ex.data) {
    return start_game(JSON.parse(default_universe));
  }
  real_savegame_id = ex.id;
  flyi_finish = new Date(ex.updated).getTime() + flyi_time;
  if (flyi_finish <= (/* @__PURE__ */ new Date()).getTime()) {
    return start_game(ex.data);
  }
  mode = "flyi";
  start_game(ex.data);
  flyi_switch(true);
  flyi_step();
  flyi_interval = setInterval(flyi_step, 1e3);
}
function flyi_step() {
  const flyi_remain = flyi_finish - (/* @__PURE__ */ new Date()).getTime();
  gebi("flyi_time").innerText = "" + new Date(flyi_remain).toISOString().substring(11, 19);
  if (flyi_remain >= 1e3)
    return;
  mode = "real";
  clearInterval(flyi_interval);
  flyi_switch(false);
}
function flyi_switch(on) {
  gebi("mapTitle_flying").style.display = on ? "" : "none";
  gebi("mapTitle_player").style.display = on ? "none" : "";
  gebi("fpTitle_normal").style.display = on ? "none" : "";
  gebi("fpTitle_flyi").style.display = on ? "" : "none";
  gebi("myFlightplan").style.display = on ? "none" : "";
  gebi("fp_hint").style.display = on ? "none" : "";
  gebi("fp_flyi").style.display = on ? "" : "none";
}
function start_game(universe) {
  gebi("main").style.display = "flex";
  loadUniverse(universe);
  if (!check())
    alert("universe error, check console");
  set_shown_star(player_star);
  redraw();
}
var save_game = function() {
  console.log("simple mode save_game");
  localStorage["space2d2" + mode] = JSON.stringify(saveUniverse());
};
function jump() {
  if (shown_star == player_star)
    return;
  if (shown_star.visited)
    return;
  stats.s++;
  stats.p += flightplan.steps.length - 1;
  stats.jf += flightplan.countJobs();
  stats.js += player_star.jobs;
  console.clear();
  moveToNewStar(shown_star, player_star);
  var lastCargo = flightplan.lastStep.cargo;
  var direction = shown_star.neighbours.directionOf(player_star);
  flightplan.init(direction.x, direction.y, lastCargo, gebi("myFlightplan"));
  player_star.visited = true;
  set_player_star(shown_star);
  save_game();
  redraw();
  if (!check())
    alert("universe error, check console");
  if (mode != "real")
    return;
  mode = "flyi";
  flyi_finish = (/* @__PURE__ */ new Date()).getTime() + flyi_time;
  flyi_switch(true);
  flyi_step();
  flyi_interval = setInterval(flyi_step, 1e3);
}
window.onhashchange();
window.jump = jump;
window.redraw = redraw;
window.flightplan = flightplan;
window.redrawFlightplan = redrawFlightplan;
window.set_shown_star = set_shown_star;
window.get_shown_star = () => shown_star;
window.player_star = player_star;
window.get_player_star = () => player_star;
window.save_game = save_game;
if (location.hostname == "localhost") {
  new EventSource("/esbuild").addEventListener("change", () => location.reload());
}
export {
  gebi,
  jump,
  mode,
  redraw
};
//# sourceMappingURL=script.js.map
