export function randomInt(a: number, b: number): number {
	if (a > b) [a, b] = [b, a];
	return Math.floor(Math.random() * (b - a + 1)) + a;
}

export function randomFrom<T>(a: T[]): T {
	return a[Math.floor(Math.random() * a.length)];
}

export function shuffle<T>(array: T[]): T[] {
	return array.map((a: any) => ({ sort: Math.random(), value: a }))
		.sort((a: { sort: number; }, b: { sort: number; }) => a.sort - b.sort)
		.map((a: { value: any; }) => a.value)
}

export function seq(a: number): number[] {
	return [...Array(a).keys()]
	//=> [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
}
