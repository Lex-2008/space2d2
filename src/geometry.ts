type vector = [number, number];

function normVector(x: number, y: number): vector {
	const d = Math.hypot(x, y);
	return [x / d, y / d];
}

function scalarMul(v1: vector, v2: vector): number {
	return v1[0] * v2[0] + v1[1] * v2[1];
}

interface point {
	x: number,
	y: number
}

// see http://www.gamedev.ru/code/forum/?id=74832 and https://ru.wikipedia.org/wiki/Расстояние_от_точки_до_прямой_на_плоскости#Прямая_задана_двумя_точками
function dotOnLine(a: point, b: point, p: point): vector {
	const v = normVector(a.x - b.x, a.y - b.y);
	const m = scalarMul(v, [p.x - b.x, p.y - b.y]);
	return [b.x + v[0] * m, b.y + v[1] * m];
}

// does a-b line cross obj p with size?
export function lineCrossesObj(a: point, b: point, p: point, size: number) {
	const [x, y] = dotOnLine(a, b, p);
	return x >= Math.min(a.x, b.x) &&
		x <= Math.max(a.x, b.x) &&
		y >= Math.min(a.y, b.y) &&
		y <= Math.max(a.y, b.y) &&
		Math.hypot(x - p.x, y - p.y) < size;
}


// see https://e-maxx.ru/algo/segments_intersection_checking

function area(a: point, b: point, c: point) {
	return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function intersect_1(a: number, b: number, c: number, d: number) {
	if (a > b) [a, b] = [b, a];
	if (c > d) [c, d] = [d, c];
	return Math.max(a, c) <= Math.min(b, d);
}

export function intersect(a: point, b: point, c: point, d: point) {
	return intersect_1(a.x, b.x, c.x, d.x)
		&& intersect_1(a.y, b.y, c.y, d.y)
		&& area(a, b, c) * area(a, b, d) <= 0
		&& area(c, d, a) * area(c, d, b) <= 0;
}
