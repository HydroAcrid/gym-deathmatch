declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;

type TestExpectMatchers = {
	toBe(expected: unknown): void;
	toBeGreaterThanOrEqual(expected: number): void;
};

declare function expect(actual: unknown): TestExpectMatchers;
